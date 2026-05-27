import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDatabase } from "../src/config/db.js";
import { getEnv } from "../src/config/env.js";
import { User } from "../src/modules/users/user.model.js";
import { Team } from "../src/modules/teams/team.model.js";
import { hashPassword } from "../src/modules/auth/auth.service.js";

dotenv.config();

async function seed() {
  getEnv();
  await connectDatabase();

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!@#";

  let team = await Team.findOne({ slug: "general-support" });
  if (!team) {
    team = await Team.create({
      name: "General Support",
      description: "Default support team",
      isDefault: true,
      isActive: true,
      members: []
    });
    console.log("Created team:", team.name);
  }

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const admin = await User.create({
      name: "System Admin",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "admin",
      isActive: true
    });
    console.log("Created admin:", admin.email);
  } else {
    console.log("Admin already exists:", adminEmail);
  }

  const managerEmail = process.env.SEED_MANAGER_EMAIL || "manager@example.com";
  let manager = await User.findOne({ email: managerEmail });
  if (!manager) {
    manager = await User.create({
      name: "Support Manager",
      email: managerEmail,
      passwordHash: await hashPassword(process.env.SEED_MANAGER_PASSWORD || "Manager123!@#"),
      role: "manager",
      teamId: team._id,
      isActive: true
    });
    team.managerId = manager._id;
    team.members = [...new Set([...team.members.map(String), String(manager._id)])].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    await team.save();
    console.log("Created manager:", manager.email);
  }

  const agentEmail = process.env.SEED_AGENT_EMAIL || "agent@example.com";
  let agent = await User.findOne({ email: agentEmail });
  if (!agent) {
    agent = await User.create({
      name: "Support Agent",
      email: agentEmail,
      passwordHash: await hashPassword(process.env.SEED_AGENT_PASSWORD || "Agent123!@#"),
      role: "agent",
      teamId: team._id,
      isActive: true
    });
    await Team.updateOne({ _id: team._id }, { $addToSet: { members: agent._id } });
    console.log("Created agent:", agent.email);
  }

  const customerEmail = process.env.SEED_CUSTOMER_EMAIL || "customer@example.com";
  if (!(await User.findOne({ email: customerEmail }))) {
    const customer = await User.create({
      name: "Demo Customer",
      email: customerEmail,
      passwordHash: await hashPassword(process.env.SEED_CUSTOMER_PASSWORD || "Customer123!@#"),
      role: "customer",
      isActive: true
    });
    console.log("Created customer:", customer.email);
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
