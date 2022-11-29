//-----------------------------------------------------------------------------------------
//Маршрутизация для проверки доступа к функциональному модулю или конкретному ресурсу
//-----------------------------------------------------------------------------------------

const { Router } = require('express');
const { check, validationResult }
    = require('express-validator');         //для валидации поступивших данных
const bcrypt = require('bcryptjs');         //для шифрования пароля
const jwt = require('jsonwebtoken');        //для работы с токенами
const router = Router();                    //маршрутизация
const logger = require('../logger/logger'); //логгер
const fetch = require('node-fetch');
const config = require("config");           //подключение конфига
const { address_config }
    = require('../config/address.config');  //константы маршрутов
const {                                     //подключение моделей для взаимодействия с базой данных
    User, PersonalData, UserAttributes,
    UserModules, GroupAttributes, GroupModules,
    UserGroups, UserRoles, TaskMarks,
    DataPlayers, Commands, CoordPlayers,
    InfoGames, Quests, RegisterCommands,
    Marks,
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); //проверка токена
const authMiddleware = require('../middlewares/auth-middleware');

//prefix: /sequrity/access
router.post(                        //проверка доступа к функциональным модулям (подтверждение)
    address_config.s_access,
    authMiddleware,
    async (req, res) => {
        try {
            const { users_id, name_module } = req.body;
            /*const result_verify = await checkTokenAccess(access_token);

            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_access,
                    message: "Попытка обращения к модулю неавторизованного пользователя",
                    data: {
                        date: {
                            users_id: users_id,
                            name_module: name_module
                        }
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка обращения к модулю неавторизованного пользователя" });
            }*/

            /* Альтернативный вариант проверки токена, но без проверки токена OAuth
             * try {
                jwt.verify(token, config.get('jwtSecret')); //верификация токена пользователя для его идентификации
            } catch (e) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_access,
                    message: e.message,
                    data: {
                        date: {
                            email: email,
                            name_module: name_module
                        }
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка обращения к модулю неавторизованного пользователя" });
            }*/

            const candidatModules = await UserModules.findOne({ where: { users_id: users_id } });
            const candidatGroup = await UserGroups.findOne({ where: { users_id: users_id } });
            let candidatGroupModules = null;

            let resultModules = {
                player: false,
                judge: false,
                creator: false,
                moderator: false,
                manager: false,
                admin: false,
                super_admin: false
            };

            if (candidatGroup && candidatGroup.id) {
                candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
                if (!candidatGroupModules) {
                    logger.error({
                        method: 'POST',
                        address: address_config.sequrity_access,
                        message: 'В группе пользователей нет данных о доступных модулях данного пользователя',
                        date: {
                            email: email,
                            users_groups_id: candidatGroup.users_groups_id
                        }
                    });
                } else {
                    resultModules = {
                        player: candidatGroupModules.player,
                        judge: candidatGroupModules.judge,
                        creator: candidatGroupModules.creator,
                        moderator: candidatGroupModules.moderator,
                        manager: candidatGroupModules.manager,
                        admin: candidatGroupModules.admin,
                        super_admin: candidatGroupModules.super_admin
                    };
                }
            }

            if (!candidatModules) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_access,
                    message: 'Ошибка при попытки проверки доступа к модулям для незарегистрированного пользователя',
                    date: {
                        users_id: users_id,
                        name_module: name_module
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Ошибка при проверке доступа", check: false });
            }

            resultModules[name_module] = (resultModules[name_module] || candidatModules[name_module]);

            //проверка прав доступа на определённый модуль
            if (resultModules[name_module] === false) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_access,
                    message: 'Не соответствие прав доступа на уровне использования модулей',
                    date: {
                        users_id: users_id,
                        name_module: name_module
                    }
                });

                return res.status(201).json({ "errors": null, "message": "Нет доступа", check: false });
            }

            logger.info({
                method: 'POST',
                address: address_config.sequrity_access,
                message: 'Успешная проверка пользовательских прав доступа к функциональному модулю',
                date: {
                    users_id: users_id,
                    name_module: name_module
                }
            });

            /*формирование токена для подтверждения прав доступа
            //данный токен будет заменён на предыдущий, для
            //обеспечения более высокой безопасности (частая смена токенов)
            const tokenAccess = jwt.sign(
                {
                    check: true
                },
                config.get('jwtSecret'),
                {
                    expiresIn: '1h'
                }
            );*/

            res.status(201).json({
                "errors": null, "message": null
            }); //передача токена клиентской части приложения, подтверждающего права пользователя

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.sequrity_access,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /sequrity/token
router.post(                        // Проверка подлинности токена
    address_config.s_token,
    async (req, res) => {
        try {
            const { access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_token,
                    message: "Ошибка при аутентификации",
                });
                return res.status(201).json({ "errors": null, "message": "Ошибка при аутентификации" });
            }

            logger.info({
                method: 'POST',
                address: address_config.sequrity_token,
                message: 'Успешная аутентификация',
            });

            res.status(201).json({
                "errors": null, "message": null,
                check: true
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.sequrity_token,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /sequrity/exists
router.post(                        // Проверка существования аккаунта с определённым users_id
    address_config.s_exists,
    [
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_exists,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Ошибка при проверке пользователя",
                });
            }

            const { users_id } = req.body;
            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.sequrity_exists,
                    message: 'Попытка получения информации обо всех метках незарегистрированным пользователем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            logger.info({
                method: 'POST',
                address: address_config.sequrity_exists,
                message: 'Успешная проверка существования пользователя',
                date: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                check: true
            });
        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.sequrity_exists,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });


module.exports = router;