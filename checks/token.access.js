//***********************
//Общая проверка токенов
//***********************

const jwt = require('jsonwebtoken');        //для работы с токенами
const fetch = require('node-fetch');
const config = require("config");           //подключение конфига
const { address_config }
    = require('../config/address.config');  //константы маршрутов

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
        await fetch(address_config.google_sequrity_oauth + token)
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

module.exports.checkTokenAccess = checkTokenAccess;