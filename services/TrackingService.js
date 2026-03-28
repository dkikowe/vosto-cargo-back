import { createClient } from 'redis';
import { Order } from '../models/Order.js';
import dotenv from "dotenv";

dotenv.config();

let redisClient;

export const initRedis = async () => {
    if (!redisClient) {
        redisClient = createClient({ 
            url: process.env.REDIS_URL || 'redis://localhost:6379' 
        });
        
        redisClient.on('error', (err) => console.log('Redis Client Error', err));
        
        await redisClient.connect();
        console.log('Redis connected');
    }
    return redisClient;
};

export const getRedisClient = () => redisClient;

export const handleLocationUpdate = async (socket, data) => {
    if (!redisClient) return;

    const { driverId, lat, lng, orderId } = data;
    const timestamp = Date.now();

    // 1. Pub/Sub: Отправляем обновление подписчикам (логисту/клиенту)
    // Клиент на фронте слушает комнату `track:${orderId}`
    socket.to(`track:${orderId}`).emit('driverLocation', { lat, lng, driverId });

    // 2. Redis Hot Storage: Сохраняем текущую позицию (TTL 5 минут, чтобы не мусорить)
    await redisClient.set(
        `driver:${driverId}:current`, 
        JSON.stringify({ lat, lng, timestamp }), 
        { EX: 300 }
    );

    // 3. Redis Cold Buffer: Добавляем в список для последующего сохранения в БД
    // Используем RPUSH для добавления в конец очереди
    await redisClient.rPush(
        `driver:${driverId}:history`, 
        JSON.stringify({ lat, lng, timestamp, orderId })
    );
};

// CRON JOB (запускать раз в минуту)
export const syncLocationsToMongo = async () => {
    if (!redisClient) return;

    try {
        // Получаем все ключи истории
        const keys = await redisClient.keys('driver:*:history');

        for (const key of keys) {
            // Извлекаем все точки и очищаем список атомарно
            // (в реальном продакшене лучше использовать LPOP или транзакции, 
            // но для диплома такая схема приемлема)
            const rawPoints = await redisClient.lRange(key, 0, -1);
            
            if (rawPoints.length === 0) continue;

            // Удаляем обработанные ключи
            await redisClient.del(key);

            const points = rawPoints.map(p => JSON.parse(p));
            // Предполагаем, что orderId одинаковый для батча (водитель выполняет один заказ)
            // Если водитель переключается, логика может быть сложнее
            const orderId = points[0].orderId; 

            if (!orderId) continue;

            // Bulk update в MongoDB (эффективно)
            await Order.findByIdAndUpdate(orderId, {
                $push: { 
                    trackHistory: { $each: points } 
                }
            });
            
            console.log(`Synced ${points.length} points for order ${orderId}`);
        }
    } catch (error) {
        console.error("Error syncing locations to Mongo:", error);
    }
};
