//-----------------------------------------------------------------------------------------
//Маршрутизация для использования сервисов Google
//-----------------------------------------------------------------------------------------

const { Router } = require('express');
const jwt = require('jsonwebtoken');        
const router = Router();
const logger = require('../logger/logger');
const config = require("config");      
const { check, validationResult } = require('express-validator');
const NodeGeocoder = require('node-geocoder');  //подключение геокодера
const fetch = require('node-fetch');

const options = {       //опции геокодера
    provider: 'google',
    apiKey: config.get("apiKey"),
    language: "ru"
};

const geocoder = NodeGeocoder(options); //инициализация геокодера

//проверка токена на работоспособность
const checkTokenAccess = async (token) => {
    try {
        //попытка верифицировать токен JWT
        jwt.verify(token, config.get('jwtSecret')); //верификация токена пользователя для его идентификации
        return true;
    } catch (e) {
        //попытка верифицировать токен OAuth
        let verified_email = false;
        //проверка полученного токена (обращение к сервисам google для подтверждения авторизации)
        await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token)
            .then(res => res.json())
            .then(json => {
                verified_email = json.verified_email;
            });

        if (!verified_email) {
            return false;
        }

        return true;
    }
}

//prefix: /google/geocoder/values
router.post(            //получение полного адреса по координатам на карте
    '/geocoder/values',
    [
        check('lat', 'latitude должно быть вещественным числовым значением').isFloat(),
        check('lng', 'longtitude должно быть вещественным числовым значением').isFloat(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { lat, lng, token } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: '/google/geocoder/values',
                    message: 'Ошибка при валидации входных данных для получения адреса',
                    date: {
                        lat: lat,
                        lng: lng
                    }
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные для получения адреса"
                });
            }

            const result_verify = await checkTokenAccess(token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: '/google/geocoder/values',
                    message: e.message,
                });
                res.status(201).json({ "errors": null, "message": "Попытка получения данных неавторизованным пользователем" });
            }

            //конвертирование координат в адрес
            const result = await geocoder.reverse({ lat: lat, lon: lng });

            logger.info({
                method: 'POST',
                address: '/google/geocoder/values',
                message: 'Получение адреса метки по её координатам',
                date: {
                    lat: lat,
                    lng: lng
                }
            });
            res.status(201).json({ "errors": null, "message": null, address: result[0].formattedAddress });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: '/google/geocoder/values',
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

module.exports = router;