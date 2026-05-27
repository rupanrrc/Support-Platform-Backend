import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "crypto";
import mongoose from "mongoose";
import { getEnv } from "../../config/env.js";
import { User } from "../users/user.model.js";
import { Team } from "../teams/team.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendEmail } from "../../utils/mailer.js";
import { sha256Hex } from "../../utils/sha256.js";
import { blacklistToken, isTokenBlacklisted } from "../../utils/tokenBlacklist.js";

const BCRYPT_COST = 12;
const RESET_TOKEN_BYTES = 32;

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * @param {string} password
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * @param {{ _id: unknown; role: string; teamId?: unknown }} user
 */
export function generateTokenPair(user) {
  const env = getEnv();
  const jti = randomUUID();

  const accessToken = jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      teamId: user.teamId ? String(user.teamId) : null
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    {
      sub: String(user._id),
      type: "refresh",
      jti
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken, refreshJti: jti };
}

/**
 * @param {string} refreshToken
 * @returns {{ sub: string; jti: string }}
 */
export function verifyRefreshToken(refreshToken) {
  const env = getEnv();

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    if (typeof payload !== "object" || payload === null) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const sub = payload.sub;
    const jti = payload.jti;
    const type = payload.type;

    if (type !== "refresh" || typeof jti !== "string" || !jti) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (typeof sub !== "string" || !sub) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (isTokenBlacklisted(jti)) {
      throw new ApiError(401, "Refresh token revoked");
    }

    return { sub, jti };
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(401, "Invalid or expired refresh token");
  }
}

/**
 * @param {string} jti
 */
export function blacklistRefreshJti(jti) {
  blacklistToken(jti);
}

/**
 * @param {{ to: string; template: string; data: Record<string, unknown> }} params
 */
export async function sendPasswordResetEmail({ to, template, data }) {
  if (template !== "password_reset") {
    throw new ApiError(500, "Unsupported email template");
  }

  const resetUrl = String(data.resetUrl || "");
  const subject = "Reset your password";
  const text = `You requested a password reset.\n\nOpen this link to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

  await sendEmail({ to, subject, text });
}

/**
 * @param {import("mongoose").Types.ObjectId | string} teamId
 */
async function assertTeamExists(teamId) {
  const team = await Team.findById(teamId).select("_id isActive").lean();
  if (!team || team.isActive === false) {
    throw new ApiError(400, "Team does not exist or is inactive");
  }
}

/**
 * @param {{
 *   name: string;
 *   email: string;
 *   password: string;
 *   role?: string;
 *   teamId?: string | null;
 * }} input
 * @param {{ id: string; role: string; teamId: string | null } | undefined} requester
 */
export async function register(input, requester) {
  const userCount = await User.countDocuments();

  let role = input.role ?? "customer";
  let teamId = input.teamId ?? null;

  if (userCount === 0) {
    role = "admin";
    teamId = null;
    if (input.role && input.role !== "admin") {
      throw new ApiError(400, "The first registered user must be an admin");
    }
  } else {
    if (!requester || requester.role !== "admin") {
      throw new ApiError(403, "Only an admin can register users");
    }
  }

  if (role === "agent" || role === "manager") {
    if (!teamId) {
      throw new ApiError(400, "teamId is required for agent and manager roles");
    }
    await assertTeamExists(teamId);
  }

  if (role === "customer" || role === "admin") {
    teamId = null;
  }

  const email = input.email.toLowerCase().trim();

  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new ApiError(409, "Email is already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    role,
    teamId: teamId ? new mongoose.Types.ObjectId(teamId) : null,
    isActive: true
  });

  const tokens = generateTokenPair(user);

  return {
    user: user.toJSON(),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

/**
 * @param {{ email: string; password: string }} input
 */
export async function login(input) {
  const email = input.email.toLowerCase().trim();

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = generateTokenPair(user);

  return {
    user: user.toJSON(),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

/**
 * @param {{ refreshToken: string }} input
 */
export async function logout(input) {
  const { jti } = verifyRefreshToken(input.refreshToken);
  blacklistRefreshJti(jti);
  return { success: true };
}

/**
 * @param {{ refreshToken: string }} input
 */
export async function refresh(input) {
  const { sub, jti } = verifyRefreshToken(input.refreshToken);

  const user = await User.findById(sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, "Invalid refresh token");
  }

  blacklistRefreshJti(jti);

  const tokens = generateTokenPair(user);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

/**
 * @param {{ email: string }} input
 */
export async function forgotPassword(input) {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select("+passwordResetTokenHash +passwordResetExpires");

  const generic = {
    message: "If an account exists for that email, password reset instructions have been sent."
  };

  if (!user || !user.isActive) {
    return generic;
  }

  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = sha256Hex(rawToken);

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const env = getEnv();
  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password/${rawToken}`;

  await sendPasswordResetEmail({
    to: user.email,
    template: "password_reset",
    data: { resetUrl }
  });

  return generic;
}

/**
 * @param {{ token: string; password: string }} input
 */
export async function resetPassword(input) {
  const tokenHash = sha256Hex(input.token);

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() }
  }).select("+passwordResetTokenHash +passwordResetExpires +passwordHash");

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  user.passwordHash = await hashPassword(input.password);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  await user.save();

  return { message: "Password has been reset successfully" };
}

/**
 * @param {string} userId
 */
export async function getProfile(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  delete user.passwordHash;
  delete user.passwordResetTokenHash;

  return { user };
}
