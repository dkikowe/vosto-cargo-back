import jwt from 'jsonwebtoken';

/**
 * Middleware для проверки ролей
 * @param {string[]} roles - Массив разрешенных ролей, например ['admin', 'logistician']
 */
export const checkRole = (roles) => {
  return (req, res, next) => {
    if (req.method === "OPTIONS") {
      next();
    }

    try {
      const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
      if (!token) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      
      // Сохраняем данные пользователя в реквест для дальнейшего использования
      req.user = decoded;

      // Проверка роли
      if (!roles.includes(decoded.role)) {
        return res.status(403).json({ message: "Нет доступа (недостаточно прав)" });
      }

      next();
    } catch (e) {
      console.log(e);
      return res.status(401).json({ message: "Пользователь не авторизован" });
    }
  };
};
