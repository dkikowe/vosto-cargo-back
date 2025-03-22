import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  name: { type: String, default: "" },
  inn: { type: String, default: "" }, // ИНН
  ogrn: { type: String, default: "" }, // ОГРН
  profile: { type: String, default: "" }, // Профиль (например, "экспедитор-перевозчик")
  country: { type: String, default: "" }, // Страна
  city: { type: String, default: "" }, // Город
  email: { type: String, default: "" }, // Почта
  website: { type: String, default: "" }, // Сайт
  manager: { type: String, default: "" }, // Руководитель
  phone: { type: String, default: "" }, // Телефон
  jobTitle: { type: String, default: "" }, // Должность
  department: { type: String, default: "" }, // Подразделение
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: {
      type: String,
    },
    telegramId: { type: String, unique: true, required: true },
    avatar: { type: String, default: "" },
    // Теперь company – это поддокумент со множеством полей
    company: { type: companySchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
