//-----------------------------------------------------------------------------------------
//Маршрутизация для взаимодействия с картой
//-----------------------------------------------------------------------------------------

const { Router } = require('express');
const { check, validationResult }
    = require('express-validator');         // Для валидации поступивших данных
const bcrypt = require('bcryptjs');         // Для шифрования пароля
const jwt = require('jsonwebtoken');        // Для работы с токенами
const router = Router();                    // Маршрутизация
const logger = require('../logger/logger'); // Логгер
const fetch = require('node-fetch');
const config = require("config");           // Подключение конфига
const { address_config }
    = require('../config/address.config');  // Константы маршрутов
const {                                     // Подключение моделей для взаимодействия с базой данных
    User, UserModules,
    InfoGames, Quests,
    Marks, GamesQuests, CheckedGames,
    QueueGamesCheck, sequelize, Sequelize
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); // Проверка токена
const NodeGeocoder
    = require('node-geocoder');             // Подключение геокодера
const authMiddleware = require('../middlewares/auth-middleware');

const options = {                           // Настройка геокодера
    provider: 'google',
    apiKey: config.get("apiKey"),
    language: "ru"
};

const geocoder = NodeGeocoder(options);     // Инициализация геокодера

//prefix: /map/geocoder/address
router.post(            // Получение полного адреса по координатам на карте
    address_config.m_geocoder_address,
    [
        authMiddleware,
        check('lat', 'latitude должно быть вещественным числовым значением').isFloat(),
        check('lng', 'longtitude должно быть вещественным числовым значением').isFloat(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { lat, lng } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_geocoder_address,
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

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_geocoder_address,
                    message: e.message,
                });
                res.status(201).json({ "errors": null, "message": "Попытка получения данных неавторизованным пользователем" });
            }*/

            //конвертирование координат в адрес
            const result = await geocoder.reverse({ lat: lat, lon: lng });

            logger.info({
                method: 'POST',
                address: address_config.map_geocoder_address,
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
                address: address_config.map_geocoder_address,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /map/marks/add
router.post(                    //добавление меток
    address_config.m_marks_add,
    [
        authMiddleware,
        check('location', 'Максимальная длина местоположение не может быть меньше 3 символов')
            .isLength({ min: 3 }),
        check('latitude', 'Значение latitude должно быть вещественным').isFloat(),
        check('longtitude', 'Значение longtitude должно быть вещественным').isFloat()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { latitude, longtitude, location, users_id } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_add,
                    message: 'Ошибка при валидации входных данных для регистрации пользователя',
                    data: {
                        users_id: users_id,
                        lat: latitude,
                        lng: longtitude,
                        location: location
                    }
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при регистрации пользователя"
                });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_add,
                    message: 'Попытка добавления метки незарегистрированным пользователем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }


            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_add,
                    message: e.message,
                    data: {
                        users_id: users_id,
                        lat: latitude,
                        lng: longtitude,
                        location: location
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка добавления метки не авторизованным пользователем" });
            }

            const modules = await UserModules.findOne({ where: { users_id: users_id } });

            //добавление меток осуществляет только администратор или супер-администратор
            if ((modules.dataValues.admin === false)
                && (modules.dataValues.super_admin === false)
            ) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_add,
                    message: "Попытка добавления новой метки не имея доступа к функциональному модулю admin и super_admin",
                    data: {
                        users_id: users_id,
                        lat: latitude,
                        lng: longtitude,
                        location: location
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            await Marks.create({
                lat: latitude,
                lng: longtitude,
                location: location,
            });

            logger.info({
                method: 'POST',
                address: address_config.map_marks_add,
                message: 'Добавление новой метки',
                date: {
                    lat: latitude,
                    lng: longtitude,
                    location: location
                }
            });
            res.status(201).json({ "errors": null, "message": null });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.map_marks_add,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /map/marks
router.post(                 //получение всех существующих меток
    address_config.m_marks,
    authMiddleware,
    async (req, res) => {
        try {

            const { users_id, access_token } = req.body;

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks,
                    message: e.message,
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks,
                    message: 'Попытка получения информации о всех метках незарегистрированным пользователем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const data = await Marks.findAll({
                attributes: ['lat', 'lng', 'location']
            });

            logger.info({
                method: 'POST',
                address: address_config.map_marks,
                message: 'Получение всех меток задач',
            });
            res.status(201).json({ "errors": null, "message": null, "data": data });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.map_marks,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /map/marks/free
router.post(                     //получение информации обо всех свободных метках
    address_config.m_marks_free,
    authMiddleware,
    async (req, res) => {
        try {
            const { users_id } = req.body;

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_free,
                    message: "Попытка обращения к модулю не авторизованным пользователем",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка обращения к модулю не авторизованным пользователем" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.map_marks_free,
                    message: 'Попытка получения информации обо всех метках незарегистрированным пользователем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const allGames = await InfoGames.findAll({
                where: {
                    date_end: {
                        [Sequelize.Op.gt]: new Date()
                    }
                },
                include: {
                    model: GamesQuests
                }
            });

            const busyMarks = [];
            for (let i = 0; i < allGames.length; i++) {
                let dataQuests = await Quests.findAll({
                    where: {
                        id: {
                            [Sequelize.Op.in]: allGames[i].dataValues.games_quests.map(item => {
                                return item.dataValues.quests_id;
                            })
                        }
                    }
                });

                for (let j = 0; j < dataQuests.length; j++) {
                    busyMarks.push(dataQuests[j].dataValues.marks_id);
                }
            }

            //console.log(busyMarks);
            const freeMarks = await Marks.findAll({
                where: {
                    id: {
                        [Sequelize.Op.notIn]: busyMarks
                    }
                }
            });

           // console.log(freeMarks);

            logger.info({
                method: 'POST',
                address: address_config.map_marks_free,
                message: 'Получение всех свободных меток',
            });
            res.status(201).json({ "errors": null, "message": null, "data": freeMarks });

        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.map_marks_free,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

module.exports = router;