/*
* Сервис обработки и генерации токенов доступа на основе JWT
*/

const config = require("config");
const jwt = require('jsonwebtoken');

class TokenServiceJWT {
    // Генерация токенов access и refresh
    generateTokens(payload) {
        let access_token = jwt.sign(payload, config.get('jwtSecret'), { expiresIn: '1h' });
        let refresh_token = jwt.sign(payload, config.get('jwt_refresh_secret'), { expiresIn: '30d' });
        
        return {
            access_token,
            refresh_token
        };
    }

    // Проверка токена access
    validateAccessToken(token) {
        try {
            const userData = jwt.verify(token, config.get('jwtSecret'));
            return userData;
        } catch (e) {
            return false;
        }
    }

    // Проверка токена refresh
    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, config.get('jwt_refresh_secret'));
            return userData;
        } catch (e) {
            return null;
        }
    }
}

module.exports = new TokenServiceJWT();