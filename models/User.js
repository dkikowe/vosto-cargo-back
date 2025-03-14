import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["shipper", "carrier", "dispatcher"],
    },
    telegramId: { type: String, unique: true, required: true },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
