import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  name: { type: String, default: "" },
  inn: { type: String, default: "" },
  ogrn: { type: String, default: "" },
  profile: { type: String, default: "" },
  country: { type: String, default: "" },
  city: { type: String, default: "" },
  email: { type: String, default: "" },
  website: { type: String, default: "" },
  manager: { type: String, default: "" },
  phone: { type: String, default: "" },
  jobTitle: { type: String, default: "" },
  department: { type: String, default: "" },
  photo: { type: String, default: "" },
});

const subscriptionSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ["none", "single", "minimal", "standard-3m", "standard-12m"],
      default: "none",
    },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    status: {
      type: String,
      enum: ["inactive", "active", "expired"],
      default: "inactive",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: "" },
    telegramId: { type: String, unique: true, required: true },
    avatar: { type: String, default: "" },
    rating: { type: Number, default: 5.0 },
    language: { type: String, default: "ru" },
    location: {
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },

    ratingHistory: [
      {
        value: { type: Number, required: true },
        reason: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    company: { type: companySchema, default: () => ({}) },
    theme: { type: String, enum: ["light", "dark"], default: "light" },

    // Старая логика — для обратной совместимости
    isPremium: { type: Boolean, default: false },

    // Новая подписка
    subscription: { type: subscriptionSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Опционально: виртуал, чтобы isPremium синхронизировался по подписке
userSchema.virtual("premiumNow").get(function () {
  const s = this.subscription || {};
  return s.status === "active" && s.expiresAt && s.expiresAt > new Date();
});

export default mongoose.model("User", userSchema);
