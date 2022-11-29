//***********************************************************
// Маршрутизация для авторизации и регистрации пользователя
//***********************************************************

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
    User, PersonalData, UserAttributes,
    UserModules, GroupAttributes, GroupModules,
    UserGroups, UserRoles,
    DataPlayers, CoordPlayers,
    Activations, Tokens, AuthTypes
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); // Проверка токена
const mailService
    = require('../services/mails/mail-service');  // Сервис для работы с почтой
const uuid
    = require('uuid');
const { google } = require('googleapis');

const tokenService
    = require('../services/tokens/token-service');         // Общий сервис для работы с токенами
const tokenServiceJWT
    = require('../services/tokens/jwt-token-service');     // Сервис для работы с JWT-токенами
const tokenServiceOAuth2
    = require('../services/tokens/oauth-token-service');   // Сервис для работы с OAuth2-токенами


// Глобальная константа доступных сервисов аутентификации
const services = {
    0: 'NetMan Service',
    1: 'Google OAuth2'
};

//prefix: /auth/refresh/token
router.post(address_config.a_refresh_token, async (req, res) => {
    try {
        const { refresh_token, type_auth } = req.body;

        // Декодирование токена обновления (с пользовательскими данными)
        let userData = null;
        
        console.log(refresh_token, type_auth);
        switch(Number(type_auth)){
            case 0: {
                userData = tokenServiceJWT.validateRefreshToken(refresh_token);
                break;
            }

            case 1: {
                const findData = await tokenService.findUserByRefreshToken(refresh_token, type_auth);
                userData = {
                    users_id: findData.id,
                    email: findData.email
                };

                break;
            }
        }

        let candidat = null;
        if(type_auth == 1){
            // При OAuth2 авторизации для определения внутреннего ID пользователя
            // необходимо осуществить его поиск в базе данных
            candidat = await User.findOne({ where: { email: userData.email } });
            userData.users_id = candidat.id;
        }

        // Поиск записи о токене в базе данных по токену и пользовательскому ID
        const tokenExists = await tokenService.findToken(refresh_token, userData.users_id);

        // Проверка валидности токена
        if ((!userData) || (!tokenExists)) {
            logger.error({
                method: 'POST',
                address: address_config.auth_refresh_token,
                message: "Пользователь не авторизован",
            });
            return res.status(401).json({ "errors": null, "message": "Пользователь не авторизован" });
        }

        // Поиск информации о пользователе
        if(!candidat){
            candidat = await User.findOne({ where: { id: userData.users_id } });
        }

        if (!candidat) {
            logger.error({
                method: 'POST',
                address: address_config.auth_refresh_token,
                message: 'Аккаунта с данным почтовым адресом не существует',
            });
            return res.status(404).json({ "errors": null, "message": `Аккаунта с почтовым адресом ${email} не существует` });
        }

        // Определение типа вторизации
        const typeAuth = await AuthTypes.findOne({
            where: {
                users_id: candidat.id
            }
        });

        if (typeAuth.type !== type_auth) {
            logger.error({
                method: 'POST',
                address: address_config.auth_refresh_token,
                message: 'Модификация аутентификационных данных пользователем',
            });
            return res.status(404).json({ "errors": null, "message": `Была осуществлена модификация аутентификационных данных. Необходимо авторизоваться заново` });
        }

        // ******
        // Логика определения прав доступа
        const candidatAttributes = await UserAttributes.findOne({ where: { users_id: candidat.id } });
        const candidatModules = await UserModules.findOne({ where: { users_id: candidat.id } });
        const candidatGroup = await UserGroups.findOne({ where: { users_id: candidat.id } });
        let candidatGroupModules = null;
        let candidatGroupAttributes = null;

        let resultModules = {
            player: false,
            judge: false,
            creator: false,
            moderator: false,
            manager: false,
            admin: false,
            super_admin: false
        };

        let resultAttributes = {
            read: false,
            write: false,
            update: false,
            delete: false
        };

        if (candidatGroup && candidatGroup.id) {
            candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
            candidatGroupAttributes = await GroupAttributes.findOne({ where: { users_groups_id: candidatGroup.id } });

            if ((!candidatGroupModules) && (candidatGroupAttributes)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'В группе пользователей нет данных о доступных модулях',
                });
            } else if ((candidatGroupModules) && (!candidatGroupAttributes)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'В группе пользователей нет данных о атрибутах действий',
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

                resultAttributes = {
                    read: candidatGroupAttributes.read,
                    write: candidatGroupAttributes.write,
                    update: candidatGroupAttributes.dataValues.update,
                    delete: candidatGroupAttributes.delete
                };
            }
        }

        if ((!candidat) || (!candidatAttributes) || (!candidatModules)) {
            logger.error({
                method: 'POST',
                address: address_config.auth_refresh_token,
                message: 'Ошибка при попытке авторизации не зарегистрированного пользователя',
            });
            return res.status(404).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
        }

        //определение доступа пользователя к функциональным модулям
        resultModules = {
            player: (candidatModules.player || resultModules.player),
            judge: (candidatModules.judge || resultModules.judge),
            creator: (candidatModules.creator || resultModules.creator),
            moderator: (candidatModules.moderator || resultModules.moderator),
            manager: (candidatModules.manager || resultModules.manager),
            admin: (candidatModules.admin || resultModules.admin),
            super_admin: (candidatModules.super_admin || resultModules.super_admin)
        };

        if (!(resultModules.super_admin ||
            resultModules.creator || resultModules.moderator ||
            resultModules.manager || resultModules.admin)) {
            logger.error({
                method: 'POST',
                address: address_config.auth_management_login,
                message: 'Попытка входа обычного пользователя на веб-сайт управления!',
            });
            return res.status(401).json({ "errors": null, "message": "Данный пользователь не имеет доступ к управляющему веб-сайту!" });
        }

        // Определение действий пользователя в функциональных модулях
        resultAttributes = {
            read: (candidatAttributes.read || resultAttributes.read),
            write: (candidatAttributes.write || resultAttributes.write),
            update: (candidatAttributes.dataValues.update || resultAttributes.update),
            delete: (candidatAttributes.delete || resultAttributes.delete)
        };
        // ******

        let accessToken = null;

        // Логика обновления токенов доступа по токенам обновления
        switch (typeAuth.type) {
            case 0: {
                accessToken = tokenServiceJWT.generateTokens({ users_id: candidat.id }).access_token;
                break;
            }

            case 1: {
                accessToken = tokenServiceOAuth2.refreshAccessToken(refresh_token);
                break;
            }
        }

        if(!accessToken){
            return res.status(401).json({
                "errors": null, "message": "Необходима авторизация",
            });
        }

        await tokenService.saveTokens(candidat.id, accessToken, refresh_token);

        res.status(201).json({
            "errors": null, "message": null,
            access_token: accessToken, refresh_token: refresh_token,
            users_id: candidat.id, attributes: resultAttributes,
            modules: resultModules, type_auth: typeAuth.type
        });
    } catch (e) {
        logger.error({
            method: 'POST',
            address: address_config.auth_refresh_token,
            message: e.message,
        });
        res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
    }
});

//prefix: /auth/activate
router.get(
    address_config.a_activate,
    async (req, res) => {
        try {
            const activationLink = req.params.link;
            const userData = await Activations.findOne({
                where: {
                    activation_link: activationLink
                }
            });

            if (!userData) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_activate,
                    message: 'Ошибка при подтверждении аккаунта',
                    date: {
                        activation_link: activationLink
                    }
                });

                return res.status(201).json({
                    errors: null,
                    message: "Ошибка при подтверждении аккаунта"
                });
            }

            userData.is_activated = true;
            await userData.save();

            // Переадресация клиента на страницу подтверждения
            // (отдельная страница с надписью "Ваш аккаунт подтверждён")
            return res.redirect(config.get("client_url"));
        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.auth_register,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    }
);

//prefix: /auth/register
router.post(            // Регистрация нового пользователя (default)
    address_config.a_register,
    [   //валидация входных данных
        check('email', 'Введите корректный email').isEmail(),
        check('password', 'Минимальная длина пароля должна быть 6 символов, а максимальная длина пароля - 32 символа')
            .isLength({ min: 6, max: 32 }),
        check('phone_num', 'Некорректный номер телефона').isMobilePhone("ru-RU"),
        check('location', 'Максимальная длина местоположение не может быть меньше 3 символов')
            .isLength({ min: 3 }),
        check('date_birthday', "Некорректная дата рождения").isDate({
            format: "YYYY-MM-DD"
        }),
        check('nickname', 'Минимальная длина для никнейма равна 2 символам')
            .isLength({ min: 2 }),
        check('name', 'Минимальная длина для имени равна 2 символам')
            .isLength({ min: 2 }),
        check('surname', 'Минимальная длина для фамилии равна 2 символам')
            .isLength({ min: 2 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {    //в случае возникновения ошибки - завершение с сообщением об ошибке
                logger.error({
                    method: 'POST',
                    address: address_config.auth_register,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(401).json({
                    errors: errors.array(),
                    message: "Некорректные данные при регистрации пользователя"
                });
            }

            const { email, name, surname, nickname, phone_num, location, date_birthday, password } = req.body;

            // Поиск в таблицах существующих пользователей
            const candidat = await User.findOne({ where: { email: email } });
            const candidatNickname = await PersonalData.findOne({ where: { nickname: nickname } });
            const candidatPhoneNum = await PersonalData.findOne({ where: { phone_num: phone_num } });

            if ((candidat) || (candidatNickname) || (candidatPhoneNum)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_register,
                    message: 'Попытка регистрации пользователя с email, который уже записан в базе данных',
                    date: {
                        email: email
                    }
                });
                let msg = (candidat) ? `Пользователь с почтовым адресом ${email} уже существует`
                    : (candidatNickname) ? `Пользователь с никнеймом ${nickname} уже существует`
                        : `Данный мобильный телефон занят`;
                return res.status(201).json({ "errors": null, "message": msg });
            }

            const hashedPassword = await bcrypt.hash(password, 12);         // Хэширование пароля
            const userData = await User.create({ email: email, password: hashedPassword });

            // Инициализация типа авторизации (добавление типа авторизации происходит всегда при регистрации)
            await AuthTypes.create({ userd_id: userData.id, type: 0 });

            // Генерация ссылки для активации аккаунта
            const activationLink = uuid.v4();

            await Activations.create({
                users_id: userData.id,
                is_activated: false,
                activation_link: activationLink
            });

            await mailService.sendActivationMail(email, `${config.get("api_url")}/auth/activate/${activationLink}`);

            // Генерация JWT-токенов
            const tokens = tokenServiceJWT.generateTokens({
                users_id: userData.id,
            });

            // Сохранение токенов в базу данных
            await tokenService.saveTokens(userData.id, tokens.access_token, tokens.refresh_token);

            const currentDate = (new Date()).toISOString().slice(0, 10);    //получение текущей даты
            await PersonalData.create({
                name: name, surname: surname, nickname: nickname, phone_num: phone_num,
                location: location, date_birthday: date_birthday, users_id: userData.id,
                ref_image: '', date_register: currentDate
            });

            // Установка прав доступа к модулям системы (default)
            const modules = await UserModules.create({
                player: true, judge: false, creator: false, moderator: false,
                manager: false, admin: false, super_admin: false,
                users_id: userData.id
            });

            // Установка атрибутов пользователя (default)
            const attributes = await UserAttributes.create({
                read: true, write: false, update: false, delete: false, users_id: userData.id
            });

            // Установка роли пользователя (default)
            await UserRoles.create({
                users_id: userData.id, users_groups_id: null, name_role: "player"
            });

            // Добавление информации о игроке (default):
            await DataPlayers.create({
                rating: 0, commands_id: null, users_id: userData.id
            });

            //добавление координат пользователя
            await CoordPlayers.create({
                lat: 0, lng: 0, users_id: userData.id
            });

            logger.info({
                method: 'POST',
                address: address_config.auth_register,
                message: 'Регистрация нового пользователя',
                date: {
                    email: email,
                    name: name,
                    surname: surname,
                    nickname: nickname,
                    phone_num: phone_num,
                    location: location,
                    date_birthday: date_birthday
                }
            });
            res.status(201).json({
                "errors": null, "message": null,
                ...tokens, users_id: userData.id,
                type_auth: 0,
                ...modules.dataValues,
                ...attributes.dataValues
            });

        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.auth_register,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /auth/login
router.post(            //авторизация пользователя
    address_config.a_login,
    [
        check('email', 'Введите корректный email').isEmail(),
        check('password', 'Минимальная длина пароля должна быть 6 символов')
            .isLength({ min: 6 }),
        check('password', 'Максимальная длина пароля равна 30 символам')
            .isLength({ max: 30 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(401).json({
                    errors: errors.array(),
                    message: "Некорректные данные при авторизации"
                });
            }

            const { email, password } = req.body;

            const candidat = await User.findOne({ where: { email: email } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: 'Аккаунта с данным почтовым адресом не существует',
                    date: {
                        email: email,
                    }
                });
                return res.status(401).json({ "errors": null, "message": `Аккаунта с почтовым адресом ${email} не существует` });
            }


            // Контроль изоляции авторизации и регистрации
            // ******
            const typeAuth = await AuthTypes.findOne({
                where: {
                    users_id: candidat.id
                }
            });

            if (typeAuth.type !== 0) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: `Попытка авторизации не через сервис ${services[typeAuth.type]}`,
                    date: {
                        email: email,
                    }
                });

                return res.status(401).json({ "errors": null, "message": `Аккаунт с почтовым адресом ${email} должен авторизовываться через сервис ${services[typeAuth.type]}` });
            }
            // ******

            // Проверка пароля
            const isMatch = await bcrypt.compare(password, candidat.password);
            if (!isMatch) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: 'Неверный пароль при авторизации пользователя',
                    date: {
                        email: email,
                    }
                });
                return res.status(401).json({ "errors": null, "message": "Неверный пароль, повторите попытку" });
            }

            const candidatAttributes = await UserAttributes.findOne({ where: { users_id: candidat.id } });
            const candidatModules = await UserModules.findOne({ where: { users_id: candidat.id } });
            const candidatGroup = await UserGroups.findOne({ where: { users_id: candidat.id } });
            let candidatGroupModules = null;
            let candidatGroupAttributes = null;

            let resultModules = {
                player: false,
                judge: false,
                creator: false,
                moderator: false,
                manager: false,
                admin: false,
                super_admin: false
            };

            let resultAttributes = {
                read: false,
                write: false,
                update: false,
                delete: false
            };

            if (candidatGroup && candidatGroup.id) {
                candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
                candidatGroupAttributes = await GroupAttributes.findOne({ where: { users_groups_id: candidatGroup.id } });

                if ((!candidatGroupModules) && (candidatGroupAttributes)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_login,
                        message: 'В группе пользователей нет данных о доступных модулях',
                        date: {
                            email: email,
                            users_groups_id: candidatGroup.users_groups_id
                        }
                    });
                } else if ((candidatGroupModules) && (!candidatGroupAttributes)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_login,
                        message: 'В группе пользователей нет данных о атрибутах действий',
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

                    resultAttributes = {
                        read: candidatGroupAttributes.read,
                        write: candidatGroupAttributes.write,
                        update: candidatGroupAttributes.dataValues.update,
                        delete: candidatGroupAttributes.delete
                    };
                }
            }

            if ((!candidat) || (!candidatAttributes) || (!candidatModules)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: 'Ошибка при попытке авторизации не зарегистрированного пользователя',
                    date: {
                        email: email,
                    }
                });
                return res.status(401).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            //определение доступа пользователя к функциональным модулям
            resultModules = {
                player: (candidatModules.player || resultModules.player),
                judge: (candidatModules.judge || resultModules.judge),
                creator: (candidatModules.creator || resultModules.creator),
                moderator: (candidatModules.moderator || resultModules.moderator),
                manager: (candidatModules.manager || resultModules.manager),
                admin: (candidatModules.admin || resultModules.admin),
                super_admin: (candidatModules.super_admin || resultModules.super_admin)
            };

            //определение действий пользователя в функциональных модулях
            resultAttributes = {
                read: (candidatAttributes.read || resultAttributes.read),
                write: (candidatAttributes.write || resultAttributes.write),
                update: (candidatAttributes.dataValues.update || resultAttributes.update),
                delete: (candidatAttributes.delete || resultAttributes.delete)
            };

            // Генерация JWT-токенов
            const tokens = tokenServiceJWT.generateTokens({ users_id: candidat.id });

            // Сохранение JWT-токенов
            await tokenService.saveTokens(candidat.id, tokens.access_token, tokens.refresh_token);

            logger.info({
                method: 'POST',
                address: address_config.auth_login,
                message: 'Успешная авторизация пользователя',
                date: {
                    email: email,
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                ...tokens, users_id: candidat.id,
                attributes: resultAttributes, modules: resultModules,
                type_auth: 0
            });

        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.auth_login,
                message: e.message,
            });
            res.status(401).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /auth/oauth
router.post(            //авторизация пользователя с помощью OAuth
    address_config.a_oauth,
    async (req, res) => {
        try {
            const { access_token } = req.body;
            let verified_email = false;

            //проверка полученного токена (обращение к сервисам google для подтверждения авторизации)
            await fetch(address_config.google_sequrity_oauth + access_token)
                .then(res => res.json())
                .then(json => {
                    verified_email = json.verified_email;
                });

            if (!verified_email) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_oauth,
                    message: "Email адрес не был верифицирован",
                });

                return res.status(201).json({
                    "errors": null,
                    "message": "Ошибка при авторизации, повторите попытку"
                });
            }

            let user_data = {};

            //получение данных по выданному токену (пользовательской информации)
            await fetch(address_config.google_user_data + access_token)
                .then(res => res.json())
                .then(json => {
                    user_data = json;
                });

            const email = user_data.email;
            const candidat = await User.findOne({ where: { email: email } });

            if (candidat) {
                const typeAuth = await AuthTypes.findOne({
                    where: {
                        users_id: candidat.id
                    }
                });

                if (typeAuth.type !== 1) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_login,
                        message: 'Попытка авторизации не через сервис NetMan Services',
                        date: {
                            email: email,
                        }
                    });

                    return res.status(201).json({ "errors": null, "message": `Аккаунт с почтовым адресом ${email} должен авторизовываться через сервис ${services[typeAuth.type]}` });
                }

                const candidatAttributes = await UserAttributes.findOne({ where: { users_id: candidat.id } });
                const candidatModules = await UserModules.findOne({ where: { users_id: candidat.id } });
                const candidatGroup = await UserGroups.findOne({ where: { users_id: candidat.id } });
                let candidatGroupModules = null;
                let candidatGroupAttributes = null;

                let resultModules = {
                    player: false,
                    judge: false,
                    creator: false,
                    moderator: false,
                    manager: false,
                    admin: false,
                    super_admin: false
                };

                let resultAttributes = {
                    read: false,
                    write: false,
                    update: false,
                    delete: false
                };

                if (candidatGroup && candidatGroup.id) {
                    candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
                    candidatGroupAttributes = await GroupAttributes.findOne({ where: { users_groups_id: candidatGroup.id } });

                    if ((!candidatGroupModules) && (candidatGroupAttributes)) {
                        logger.error({
                            method: 'POST',
                            address: address_config.auth_oauth,
                            message: 'В группе пользователей нет данных о доступных модулях',
                            date: {
                                email: email,
                                users_groups_id: candidatGroup.users_groups_id
                            }
                        });
                    } else if ((candidatGroupModules) && (!candidatGroupAttributes)) {
                        logger.error({
                            method: 'POST',
                            address: address_config.auth_oauth,
                            message: 'В группе пользователей нет данных о атрибутах действий',
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

                        resultAttributes = {
                            read: candidatGroupAttributes.read,
                            write: candidatGroupAttributes.write,
                            update: candidatGroupAttributes.dataValues.update,
                            delete: candidatGroupAttributes.delete
                        };
                    }
                }

                if ((!candidat) || (!candidatAttributes) || (!candidatModules)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_oauth,
                        message: 'Ошибка при попытке авторизации не зарегистрированного пользователя',
                        date: {
                            email: email,
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
                }

                //определение доступа пользователя к функциональным модулям
                resultModules = {
                    player: (candidatModules.player || resultModules.player),
                    judge: (candidatModules.judge || resultModules.judge),
                    creator: (candidatModules.creator || resultModules.creator),
                    moderator: (candidatModules.moderator || resultModules.moderator),
                    manager: (candidatModules.manager || resultModules.manager),
                    admin: (candidatModules.admin || resultModules.admin),
                    super_admin: (candidatModules.super_admin || resultModules.super_admin)
                };

                //определение действий пользователя в функциональных модулях
                resultAttributes = {
                    read: (candidatAttributes.read || resultAttributes.read),
                    write: (candidatAttributes.write || resultAttributes.write),
                    update: (candidatAttributes.dataValues.update || resultAttributes.update),
                    delete: (candidatAttributes.delete || resultAttributes.delete)
                };

                // Проверка пароля
                const isMatch = await bcrypt.compare(access_token, candidat.password);
                if (!isMatch) {
                    const hashedPassword = await bcrypt.hash(access_token, 12);         //хэширование нового пароля
                    let updateValuesUser = { password: hashedPassword };                //изменение старого пароля на новый
                    await User.update(updateValuesUser, { where: { email: email } });         //обновление нового пароля в базе данных
                }

                logger.info({
                    method: 'POST',
                    address: address_config.auth_oauth,
                    message: 'Успешная авторизация пользователя',
                    date: {
                        email: email,
                    }
                });

                return res.status(201).json({
                    "errors": null, "message": null,
                    token: access_token, users_id: candidat.id,
                    attributes: resultAttributes, modules: resultModules
                }); //передача данных клиентской части приложения
            }

            //регистрация нового пользователя, в случае, если он не был ранее зарегистрирован
            const hashedPassword = await bcrypt.hash(access_token, 12);
            const userData = await User.create({
                email: email, password: hashedPassword
            });

            const currentDate = (new Date()).toISOString().slice(0, 10);    //получение текущей даты
            await PersonalData.create({
                name: user_data.given_name, surname: user_data.family_name, nickname: user_data.name, phone_num: '',
                location: '', date_birthday: currentDate, users_id: userData.id,
                ref_image: '', date_register: currentDate
            });

            //установка прав доступа к модулям системы (default)
            await UserModules.create({
                player: true, judge: false, creator: false, moderator: false,
                manager: false, admin: false, super_admin: false,
                users_id: userData.id
            });

            //установка атрибутов пользователя (default)
            await UserAttributes.create({
                read: true, write: false, update: false, delete: false, users_id: userData.id
            });

            //установка роли пользователя (default)
            await UserRoles.create({
                users_id: userData.id, users_groups_id: null, name_role: "player"
            });

            //Добавление информации о игроке (default):
            await DataPlayers.create({
                rating: 0, commands_id: null, users_id: userData.id
            });

            //добавление координат пользователя
            await CoordPlayers.create({
                lat: 0, lng: 0, users_id: userData.id
            });

            logger.info({
                method: 'POST',
                address: address_config.auth_oauth,
                message: "Успешная авторизация с помощью OAuth",
            });

            res.status(201).json({
                "errors": null, "message": null,
                token: access_token, users_id: userData.id,
                attributes: { read: true, write: false, update: false, delete: false },
                modules: {
                    player: true, judge: false, creator: false, moderator: false,
                    manager: false, admin: false, super_admin: false
                }
            }); //передача данных клиентской части приложения
        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.auth_oauth,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /auth/management/login
router.post(            // Авторизация пользователя
    address_config.a_management_login,
    [
        check('email', 'Введите корректный email').isEmail(),
        check('password', 'Минимальная длина пароля должна быть 6 символов')
            .isLength({ min: 6 }),
        check('password', 'Максимальная длина пароля равна 30 символам')
            .isLength({ max: 30 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при авторизации"
                });
            }

            const { email, password } = req.body;
            const candidat = await User.findOne({ where: { email: email } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'Аккаунта с данным почтовым адресом не существует',
                    date: {
                        email: email,
                    }
                });
                return res.status(201).json({ "errors": null, "message": `Аккаунта с почтовым адресом ${email} не существует` });
            }

            // Контроль изоляции авторизации и регистрации
            // ******
            const typeAuth = await AuthTypes.findOne({
                where: {
                    users_id: candidat.id
                }
            });

            if (typeAuth.type !== 0) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_login,
                    message: `Попытка авторизации не через сервис ${services[typeAuth.type]}`,
                    date: {
                        email: email,
                    }
                });

                return res.status(201).json({ "errors": null, "message": `Аккаунт с почтовым адресом ${email} должен авторизовываться через сервис ${services[typeAuth.type]}` });
            }
            // ******

            // Проверка пароля
            const isMatch = await bcrypt.compare(password, candidat.password);
            if (!isMatch) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'Неверный пароль при авторизации пользователя',
                    date: {
                        email: email,
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Неверный пароль, повторите попытку или попробуйте зайти через сервисы Google" });
            }

            const candidatAttributes = await UserAttributes.findOne({ where: { users_id: candidat.id } });
            const candidatModules = await UserModules.findOne({ where: { users_id: candidat.id } });
            const candidatGroup = await UserGroups.findOne({ where: { users_id: candidat.id } });
            let candidatGroupModules = null;
            let candidatGroupAttributes = null;

            let resultModules = {
                player: false,
                judge: false,
                creator: false,
                moderator: false,
                manager: false,
                admin: false,
                super_admin: false
            };

            let resultAttributes = {
                read: false,
                write: false,
                update: false,
                delete: false
            };

            if (candidatGroup && candidatGroup.id) {
                candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
                candidatGroupAttributes = await GroupAttributes.findOne({ where: { users_groups_id: candidatGroup.id } });

                if ((!candidatGroupModules) && (candidatGroupAttributes)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_management_login,
                        message: 'В группе пользователей нет данных о доступных модулях',
                        date: {
                            email: email,
                            users_groups_id: candidatGroup.users_groups_id
                        }
                    });
                } else if ((candidatGroupModules) && (!candidatGroupAttributes)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_management_login,
                        message: 'В группе пользователей нет данных о атрибутах действий',
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

                    resultAttributes = {
                        read: candidatGroupAttributes.read,
                        write: candidatGroupAttributes.write,
                        update: candidatGroupAttributes.dataValues.update,
                        delete: candidatGroupAttributes.delete
                    };
                }
            }

            if ((!candidat) || (!candidatAttributes) || (!candidatModules)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'Ошибка при попытке авторизации не зарегистрированного пользователя',
                    date: {
                        email: email,
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            //определение доступа пользователя к функциональным модулям
            resultModules = {
                player: (candidatModules.player || resultModules.player),
                judge: (candidatModules.judge || resultModules.judge),
                creator: (candidatModules.creator || resultModules.creator),
                moderator: (candidatModules.moderator || resultModules.moderator),
                manager: (candidatModules.manager || resultModules.manager),
                admin: (candidatModules.admin || resultModules.admin),
                super_admin: (candidatModules.super_admin || resultModules.super_admin)
            };

            if (!(resultModules.super_admin ||
                resultModules.creator || resultModules.moderator ||
                resultModules.manager || resultModules.admin)) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_login,
                    message: 'Попытка входа игрока или судьи на веб-сайт управления!',
                    date: {
                        email: email,
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет доступ к управляющему веб-сайту!" });
            }

            // Определение действий пользователя в функциональных модулях
            resultAttributes = {
                read: (candidatAttributes.read || resultAttributes.read),
                write: (candidatAttributes.write || resultAttributes.write),
                update: (candidatAttributes.dataValues.update || resultAttributes.update),
                delete: (candidatAttributes.delete || resultAttributes.delete)
            };

            const tokens = tokenServiceJWT.generateTokens({ users_id: candidat.id });
            await tokenService.saveTokens(candidat.id, tokens.access_token, tokens.refresh_token);

            logger.info({
                method: 'POST',
                address: address_config.auth_management_login,
                message: 'Успешная авторизация пользователя',
                date: {
                    email: email,
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                ...tokens, users_id: candidat.id,
                attributes: resultAttributes, modules: resultModules,
                type_auth: typeAuth.type
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.auth_management_login,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /auth/management/oauth
router.post(            // Авторизация пользователя с помощью OAuth
    address_config.a_management_oauth,
    async (req, res) => {
        try {
            // Получение кода аутентификации
            const { code } = req.body;

            // Генерация токена по полученному коду
            let { access_token, refresh_token } = await tokenServiceOAuth2.generateTokens(code);

            let user_data = await tokenServiceOAuth2.validateAccessToken(access_token);

            if (!user_data) {
                logger.error({
                    method: 'POST',
                    address: address_config.auth_management_oauth,
                    message: "Пользователь не был верифицирован",
                });

                return res.status(401).json({
                    "errors": null,
                    "message": "Ошибка при авторизации, повторите попытку"
                });
            }

            const email = user_data.email;
            const candidat = await User.findOne({ where: { email: email } });

            if (!refresh_token) {
                const tokensData = await Tokens.findOne({
                    where: {
                        users_id: candidat.id
                    }
                });

                access_token = tokensData.access_token;
                refresh_token = tokensData.refresh_token;

                const validAccess = await tokenServiceOAuth2.validateAccessToken(access_token);
                if(!validAccess){
                    access_token = await tokenServiceOAuth2.refreshAccessToken(refresh_token);
                }
            }

            if (candidat) {
                // Контроль изоляции авторизации и регистрации
                // ******
                const typeAuth = await AuthTypes.findOne({
                    where: {
                        users_id: candidat.id
                    }
                });

                if (typeAuth.type !== 1) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_login,
                        message: 'Попытка авторизации не через сервис Google OAuth2',
                        date: {
                            email: email,
                        }
                    });

                    return res.status(201).json({ "errors": null, "message": `Аккаунт с почтовым адресом ${email} должен авторизовываться через сервис ${services[typeAuth.type]}` });
                }
                // ******

                const candidatAttributes = await UserAttributes.findOne({ where: { users_id: candidat.id } });
                const candidatModules = await UserModules.findOne({ where: { users_id: candidat.id } });
                const candidatGroup = await UserGroups.findOne({ where: { users_id: candidat.id } });
                let candidatGroupModules = null;
                let candidatGroupAttributes = null;

                let resultModules = {
                    player: false,
                    judge: false,
                    creator: false,
                    moderator: false,
                    manager: false,
                    admin: false,
                    super_admin: false
                };

                let resultAttributes = {
                    read: false,
                    write: false,
                    update: false,
                    delete: false
                };

                if (candidatGroup && candidatGroup.id) {
                    candidatGroupModules = await GroupModules.findOne({ where: { users_groups_id: candidatGroup.id } });
                    candidatGroupAttributes = await GroupAttributes.findOne({ where: { users_groups_id: candidatGroup.id } });

                    if ((!candidatGroupModules) && (candidatGroupAttributes)) {
                        logger.error({
                            method: 'POST',
                            address: address_config.auth_management_oauth,
                            message: 'В группе пользователей нет данных о доступных модулях',
                            date: {
                                email: email,
                                users_groups_id: candidatGroup.users_groups_id
                            }
                        });
                    } else if ((candidatGroupModules) && (!candidatGroupAttributes)) {
                        logger.error({
                            method: 'POST',
                            address: address_config.auth_management_oauth,
                            message: 'В группе пользователей нет данных о атрибутах действий',
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

                        resultAttributes = {
                            read: candidatGroupAttributes.read,
                            write: candidatGroupAttributes.write,
                            update: candidatGroupAttributes.dataValues.update,
                            delete: candidatGroupAttributes.delete
                        };
                    }
                }

                if ((!candidat) || (!candidatAttributes) || (!candidatModules)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_oauth,
                        message: 'Ошибка при попытке авторизации не зарегистрированного пользователя',
                        date: {
                            email: email,
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
                }

                //определение доступа пользователя к функциональным модулям
                resultModules = {
                    player: (candidatModules.player || resultModules.player),
                    judge: (candidatModules.judge || resultModules.judge),
                    creator: (candidatModules.creator || resultModules.creator),
                    moderator: (candidatModules.moderator || resultModules.moderator),
                    manager: (candidatModules.manager || resultModules.manager),
                    admin: (candidatModules.admin || resultModules.admin),
                    super_admin: (candidatModules.super_admin || resultModules.super_admin)
                };

                if (!(resultModules.creator || resultModules.moderator
                    || resultModules.manager || resultModules.admin
                    || resultModules.super_admin)) {
                    logger.error({
                        method: 'POST',
                        address: address_config.auth_management_login,
                        message: 'Попытка входа игрока или судьи на веб-сайт управления!',
                        date: {
                            email: email,
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет доступ к управляющему веб-сайту!" });
                }

                //определение действий пользователя в функциональных модулях
                resultAttributes = {
                    read: (candidatAttributes.read || resultAttributes.read),
                    write: (candidatAttributes.write || resultAttributes.write),
                    update: (candidatAttributes.dataValues.update || resultAttributes.update),
                    delete: (candidatAttributes.delete || resultAttributes.delete)
                };

                // Проверка пароля (beta)
                /*const isMatch = await bcrypt.compare(access_token, candidat.password);
                if (!isMatch) {
                    const hashedPassword = await bcrypt.hash(access_token, 12);         //хэширование нового пароля
                    let updateValuesUser = { password: hashedPassword };                //изменение старого пароля на новый
                    await User.update(updateValuesUser, { where: { id: candidat.id } });         //обновление нового пароля в базе данных
                }*/

                // Сохранение пары токенов
                await tokenService.saveTokens(candidat.id, access_token, refresh_token);

                logger.info({
                    method: 'POST',
                    address: address_config.auth_oauth,
                    message: 'Успешная авторизация пользователя через сервис OAuth2 (management)',
                    date: {
                        email: email,
                    }
                });

                return res.status(201).json({
                    "errors": null, "message": null,
                    access_token: access_token,
                    refresh_token: refresh_token,
                    users_id: candidat.id,
                    attributes: resultAttributes, modules: resultModules,
                    type_auth: typeAuth.type
                }); // Передача данных клиентской части приложения
            }

            logger.error({
                method: 'POST',
                address: address_config.auth_management_login,
                message: 'Попытка входа на веб-сайт управления с аккаунта, который не зарегистрирован!',
                date: {
                    email: email,
                }
            });
            return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован!" });
        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.auth_management_login,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /auth/management/logout
router.post(address_config.a_management_logout, async (req, res) => {
    try {
        const { users_id, access_token, refresh_token, type_auth } = req.body;

        const isExists = await tokenService.isExistsUser(users_id, access_token, refresh_token, type_auth);

        if(!isExists){
            logger.error({
                method: 'POST',
                address: address_config.auth_management_login,
                message: 'Попытка разлогина пользователя, который не был авторизован',
                date: {
                    users_id,
                }
            });
            return res.status(401).json({ "errors": null, "message": "Данный пользователь не авторизован" });
        }

        if(type_auth === 1){
            await tokenServiceOAuth2.removeTokenByAccessToken(access_token);
        }

        await tokenService.removeTokenByUserId(users_id);

        res.status(201).json({
            "errors": null, "message": null
        });
    } catch (e) {
        logger.error({
            method: 'POST',
            address: address_config.auth_refresh_token,
            message: e.message,
        });
        res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
    }
});


module.exports = router;