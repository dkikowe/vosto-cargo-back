import mongoose from "mongoose";

const companySchema = new mongoose.Schema({
  name: { type: String, default: null },
  inn: { type: String, default: null }, // ИНН
  ogrn: { type: String, default: null }, // ОГРН
  profile: { type: String, default: null }, // Профиль (например, "экспедитор-перевозчик")
  country: { type: String, default: null }, // Страна
  city: { type: String, default: null }, // Город
  email: { type: String, default: null }, // Почта
  website: { type: String, default: null }, // Сайт
  manager: { type: String, default: null }, // Руководитель
  phone: { type: String, default: null }, // Телефон
  jobTitle: { type: String, default: null }, // Должность
  department: { type: String, default: null }, // Подразделение
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["Грузодатель", "Грузоперевозчик", "Диспетчер"],
    },
    telegramId: { type: String, unique: true, required: true },
    avatar: { type: String, default: "" },
    // Теперь company – это поддокумент со множеством полей
    company: { type: companySchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
