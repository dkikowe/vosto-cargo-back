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
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: "" },
    telegramId: { type: String, unique: true, required: true },
    avatar: { type: String, default: "" },
    rating: { type: Number, default: 5.0 },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Новый блок
    ratingHistory: [
      {
        value: { type: Number, required: true },
        reason: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    company: { type: companySchema, default: () => ({}) },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
