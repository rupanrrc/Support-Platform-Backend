import mongoose from "mongoose";
import { slugify } from "../../utils/slugify.js";

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Team name is required"],
      unique: true,
      trim: true,
      maxlength: 120
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-safe"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: []
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

teamSchema.index({ managerId: 1 });
teamSchema.index({ members: 1 });

/**
 * Derive a unique slug from `name` when creating or renaming a team.
 */
teamSchema.pre("validate", async function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }

  if (!this.slug) {
    return;
  }

  const TeamModel = this.constructor;
  const base = this.slug;
  let candidate = base;
  let suffix = 1;

  for (;;) {
    const existing = await TeamModel.findOne({
      slug: candidate,
      _id: { $ne: this._id }
    })
      .select("_id")
      .lean();

    if (!existing) {
      this.slug = candidate;
      break;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
});

export const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);
