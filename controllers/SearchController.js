import User from "../models/User.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.BUCKET_ACCESS_KEY;
const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY;

const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
  region: bucketRegion,
});

export const getUserByTelegramId = async (req, res) => {
  try {
    const { telegramId } = req.params;

    if (!telegramId) {
      return res.status(400).json({ error: "Telegram ID is required" });
    }

    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    let avatarUrl = user.avatar;

    // Если аватар есть и это не внешняя ссылка (например, от Telegram), генерируем Signed URL
    if (user.avatar && !user.avatar.startsWith("http")) {
      try {
        const getObjectParams = {
          Bucket: bucketName,
          Key: user.avatar,
        };
        const command = new GetObjectCommand(getObjectParams);
        avatarUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      } catch (err) {
        console.error("Error generating signed URL for avatar:", err);
        // Если ошибка генерации, оставляем как есть или ставим null, чтобы не ломать ответ
      }
    }

    // Возвращаем только публичные данные
    const publicUser = {
      _id: user._id,
      name: user.name,
      telegramId: user.telegramId,
      role: user.role,
      avatar: avatarUrl,
      // Добавляем статус занятости, если это водитель
      driverStatus: user.role === 'DRIVER' ? user.driverProfile?.status : null,
      employer: user.role === 'DRIVER' ? user.driverProfile?.employer : null
    };

    res.json(publicUser);
  } catch (error) {
    console.error("Error finding user by Telegram ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
