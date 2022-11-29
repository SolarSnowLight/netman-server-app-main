//-----------------------------------------------------------------------------------------
//Маршрутизация для функционального модуля "Модератор"
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
    User, PersonalData, UserModules,
    InfoGames, Quests,
    Marks, Warnings, Bans, Sequelize,
    QueueGamesCheck, CheckedGames, GamesQuests,
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access'); // Проверка токена
const { checkAccessModule }
    = require('../checks/module.access');// Проверка доступа к модулю
const authMiddleware = require('../middlewares/auth-middleware');

Array.prototype.removeIf = function (callback) {
    var i = this.length;
    while (i--) {
        if (callback(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

//prefix: /function/moderator/games/queue
router.post(                                // очередь игр, ожидающих проверки модераторов
    address_config.f_moderator_games_queue,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
           
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            const { users_id } = req.body;

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: 'Попытка просмотра очереди игр неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Попытка просмотра очереди игр пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queueGamesCheck = await QueueGamesCheck.findAll({
                attributes: ["id", "info_games_id", "date"]
            });

            const infoGamesList = [];
            for (let i = 0; i < queueGamesCheck.length; i++) {
                const elementGame = {};
                const infoGame = await InfoGames.findOne({
                    where: {
                        id: queueGamesCheck[i].info_games_id
                    }
                });

                if ((infoGame) && ((new Date(infoGame.date_begin)) > (new Date()))) {
                    elementGame.id = infoGame.id;
                    elementGame.name = infoGame.name;
                    elementGame.date_begin = infoGame.date_begin;
                    elementGame.location = infoGame.location;

                    const personals = await PersonalData.findOne({
                        where: {
                            users_id: infoGame.users_id
                        }
                    });

                    if (!personals) {
                        continue;
                    }

                    elementGame.users_id = personals.users_id;
                    elementGame.nickname = personals.nickname;

                    infoGamesList.push(elementGame);
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_games_queue,
                message: 'Получение списка новых заданий',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, infoGamesList });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_games_queue,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/creator/info
router.post(                                // очередь игр, ожидающих проверки модераторов
    address_config.f_moderator_creator_info,
    [
        authMiddleware,
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('creator_users_id', "Некорректный идентификатор создателя").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creator_info,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            const { users_id, creator_users_id } = req.body;

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id, creator_users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creator_info,
                    message: 'Попытка просмотра информации о создателе неавторизованным пользователем',
                    date: {
                        users_id, creator_users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра информации о создателе необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creator_info,
                    message: "Попытка просмотра информации о создателе пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id, creator_users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const creator = await User.findOne({ where: { id: creator_users_id } });
            const modulesCreator = await checkAccessModule(creator_users_id, "creator");

            if ((!candidat) || (!modulesCreator) || (!creator)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creator_info,
                    message: 'Данный пользователь не является создателем',
                    date: {
                        users_id, creator_users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не является создателем" });
            }

            const personalData = await PersonalData.findOne({
                where: {
                    users_id: creator_users_id
                }
            });

            const modulesAll = {
                creator: await checkAccessModule(creator_users_id, "creator"),
                moderator: await checkAccessModule(creator_users_id, "moderator"),
                manager: await checkAccessModule(creator_users_id, "manager"),
                admin: await checkAccessModule(creator_users_id, "admin"),
                superadmin: await checkAccessModule(creator_users_id, "super_admin")
            };

            personalData.dataValues.modules = modulesAll;
            personalData.dataValues.email = creator.email;

            const games = await InfoGames.findAll({ where: { users_id: creator_users_id } });

            const games_created = [];
            for (let i = 0; i < games.length; i++) {
                const index = await QueueGamesCheck.findOne({ where: { info_games_id: games[i].dataValues.id } });
                const countQuests = await GamesQuests.findAll({ where: { info_games_id: games[i].dataValues.id } });
                games[i].dataValues.count_points = countQuests.length;

                if (index) {
                    games[i].dataValues.warnings = [];
                    games[i].dataValues.bans = [];
                    games[i].dataValues.accepted = false;
                    games_created.push(games[i].dataValues);
                } else {
                    const checkedGame = await CheckedGames.findOne({ where: { info_games_id: games[i].dataValues.id } });
                    if (checkedGame) {
                        const warnings = await Warnings.findAll({ where: { checked_games_id: checkedGame.id } });
                        const bans = await Bans.findAll({ where: { checked_games_id: checkedGame.id } });
                        games[i].dataValues.warnings = warnings;
                        games[i].dataValues.bans = bans;
                        games[i].dataValues.accepted = checkedGame.dataValues.accepted;

                        games_created.push(games[i].dataValues);
                    }
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_creator_info,
                message: 'Получение информации о создателе',
                data: {
                    users_id: creator_users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, info_creator: personalData, info_games: games_created });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_creator_info,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/game/info
router.post(                                // полная информация о конкретной игре
    address_config.f_moderator_game_info,
    [
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('info_games_id', "Некорректный идентификатор игры").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_info,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            const { users_id, access_token, info_games_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_info,
                    message: 'Попытка просмотра информации об игре неавторизованным пользователем',
                    date: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра информации об игре необходимо авторизоваться" });
            }

            const modules =
                (await checkAccessModule(users_id, "moderator"))
                || (await checkAccessModule(users_id, "creator"))
                || (await checkAccessModule(users_id, "admin"))
                || (await checkAccessModule(users_id, "super_admin"));

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_info,
                    message: "Попытка просмотра информации об игре пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const infoGames = await InfoGames.findOne({
                where: {
                    id: info_games_id
                }
            });

            if (!infoGames) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_info,
                    message: "Данной игры нет в базе данных",
                    date: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данной игры нет в базе данных" });
            }

            const gamesQuests = await GamesQuests.findAll({
                where: {
                    info_games_id: info_games_id
                }
            });

            const quests = [];
            for (let i = 0; i < gamesQuests.length; i++) {
                const quest = await Quests.findOne({
                    where: {
                        id: gamesQuests[i].quests_id
                    },

                    include: {
                        model: Marks,
                    }
                });

                if (quest) {
                    quest.dataValues.lat = quest.dataValues.mark.dataValues.lat;
                    quest.dataValues.lng = quest.dataValues.mark.dataValues.lng;
                    quest.dataValues.location = quest.dataValues.mark.dataValues.location;
                    quest.dataValues.mark = undefined;

                    quests.push(quest);
                }
            }

            infoGames.dataValues.quests = quests;

            // Определение статуса игры:
            // 0 - неопределённый статус
            // 1 - игра одобрена
            // 2 - выдано предупреждение игре (нужно что-то поправить)
            // 3 - игра забанена (нельзя в неё играть)

            if ((await QueueGamesCheck.findOne({
                where: {
                    info_games_id: infoGames.id
                }
            }))) {
                infoGames.dataValues.status = 0;
            } else {
                const checkedGames = await CheckedGames.findOne({
                    where: {
                        info_games_id: infoGames.id
                    }
                });

                if (!checkedGames) {
                    infoGames.dataValues.status = 0;
                } else if (!checkedGames.accepted) {
                    const bans = await Bans.findAll({
                        where: {
                            checked_games_id: checkedGames.id
                        }
                    });

                    const warnings = await Warnings.findAll({
                        where: {
                            checked_games_id: checkedGames.id
                        }
                    });

                    infoGames.dataValues.moderator = {
                        users_id: checkedGames.users_id,
                        nickname: (await PersonalData.findOne({
                            where: {
                                users_id: checkedGames.users_id
                            }
                        })).nickname
                    }

                    infoGames.dataValues.bans = bans;
                    infoGames.dataValues.warnings = warnings;

                    if (bans.length != 0) {
                        infoGames.dataValues.status = 3;
                    } else {
                        if (warnings.length != 0) {
                            infoGames.dataValues.status = 2;
                        } else {
                            infoGames.dataValues.status = 0;
                        }
                    }
                } else {
                    infoGames.dataValues.status = 1;
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_game_info,
                message: 'Получение списка новых заданий',
                data: {
                    users_id, info_games_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, info_games: infoGames });

        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_game_info,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/game/accepted
router.post(                                // Одобрение определённой игры и открытие регистрации на неё
    address_config.f_moderator_game_accepted,
    [
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('info_games_id', "Некорректный идентификатор игры").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { users_id, access_token, info_games_id } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_accepted,
                    message: 'Ошибка при валидации входных данных',
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при одобрении игры"
                });
            }

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_accepted,
                    message: 'Попытка одобрения игры неавторизованным пользователем',
                    date: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для одобрения игры необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_accepted,
                    message: "Попытка одобрения игры пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queue = await QueueGamesCheck.findOne({
                info_games_id: info_games_id
            });

            // Если игра в очереди, то её необходимо оттуда убрать
            if (queue) {
                await queue.destroy();
            }

            const checkedGames = await CheckedGames.findOne({
                where: {
                    users_id: users_id,
                    info_games_id: info_games_id
                }
            });

            // Добавление метки "одобрено" на текущую игру
            if (checkedGames) {
                await checkedGames.update({
                    accepted: true
                });
            } else {
                await CheckedGames.create({
                    accepted: true,
                    users_id: users_id,
                    info_games_id: info_games_id
                });
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_game_accepted,
                message: 'Одобрение задания',
                data: {
                    users_id, info_games_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, accepted: true });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_game_accepted,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/games/checked
router.post(                                // список проверенных игр определённым модератором
    address_config.f_moderator_games_checked,
    [
        check('users_id', "Не корректный идентификатор пользователя").isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_checked,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_checked,
                    message: 'Попытка просмотра очереди игр неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_checked,
                    message: "Попытка просмотра очереди игр пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queueGamesCheck = await CheckedGames.findAll({
                where: {
                    users_id: users_id
                }
            });

            const infoGamesList = [];
            for (let i = 0; i < queueGamesCheck.length; i++) {
                const elementGame = {};
                const infoGame = await InfoGames.findOne({
                    where: {
                        id: queueGamesCheck[i].info_games_id
                    }
                });

                if (infoGame) {
                    elementGame.id = infoGame.id;
                    elementGame.name = infoGame.name;
                    elementGame.date_begin = infoGame.date_begin;
                    elementGame.location = infoGame.location;

                    const personals = await PersonalData.findOne({
                        where: {
                            users_id: infoGame.users_id
                        }
                    });

                    if (!personals) {
                        continue;
                    }

                    elementGame.users_id = personals.users_id;
                    elementGame.nickname = personals.nickname;

                    elementGame.warnings = await Warnings.findAll({
                        where: {
                            checked_games_id: queueGamesCheck[i].id
                        }
                    });

                    elementGame.bans = await Bans.findAll({
                        where: {
                            checked_games_id: queueGamesCheck[i].id
                        }
                    });

                    elementGame.accepted = queueGamesCheck[i].accepted;

                    infoGamesList.push(elementGame);
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_games_checked,
                message: 'Получение списка новых заданий',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, infoGamesList });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_games_checked,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/creators/list
router.post(                                // информация о всех существующих создателях
    address_config.f_moderator_creators_list,
    [
        check('users_id', "Не корректный идентификатор пользователя").isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creators_list,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при одобрении игры"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creators_list,
                    message: "Для просмотра списка создателей необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка создателей необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creators_list,
                    message: 'Попытка просмотра списка создателей неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка создателей необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_creators_list,
                    message: "Попытка просмотра списка создателей пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }


            // Получение информации о создателе (без применения групповой политики)
            const userModules = await UserModules.findAll({
                where: {
                    creator: true
                }
            });

            const dataPersonals = await PersonalData.findAll({
                where: {
                    users_id: {
                        [Sequelize.Op.in]: userModules.map((item) => item.users_id)
                    }
                }
            });

            const dataCreators = dataPersonals.map((item) => {
                return {
                    users_id: item.users_id,
                    age: Math.floor(((new Date() - new Date(item.date_birthday)) / 1000 / (60 * 60 * 24)) / 365.25),
                    ref_image: item.ref_image,
                    location: item.location,
                    name: item.name,
                    surname: item.surname,
                    nickname: item.nickname
                }
            });

            for (let i = 0; i < dataCreators.length; i++) {
                const value = await InfoGames.findAll({
                    where: {
                        users_id: dataCreators[i].users_id
                    }
                });

                dataCreators[i].count_games = (await CheckedGames.findAll({
                    where: {
                        info_games_id: {
                            [Sequelize.Op.in]: value.map((item) => item.id)
                        },
                        accepted: true
                    }
                })).length;
            }

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_creators_list,
                message: 'Просмотр списка создателей',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, creators: dataCreators });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_creators_list,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/game/warning
router.post(                                // закрепление игры за определённым модератором и выдача предупреждения о нарушении
    address_config.f_moderator_game_warning,
    [
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('info_games_id', "Некорректный идентификатор игры").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
           
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_warning,
                    message: 'Ошибка при валидации входных данных',
                    data: {
                        email,
                        info_games_id
                    }
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при одобрении игры"
                });
            }

            const { users_id, access_token, info_games_id, reason } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_warning,
                    message: 'Попытка выдача предупреждения для игры неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для выдачи предупреждения игре необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_warning,
                    message: "Попытка выдача предупреждения игре пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queue = await QueueGamesCheck.findOne({
                info_games_id: info_games_id
            });

            // Если игра в очереди, то её необходимо оттуда убрать
            if (queue) {
                await queue.destroy();
            }

            const checkedGames = await CheckedGames.findOne({
                where: {
                    users_id: users_id,
                    info_games_id: info_games_id
                }
            });

            // Добавление метки "не одобрено" на текущую игру
            let cGames = null;
            if (checkedGames) {
                cGames = await checkedGames.update({
                    accepted: false
                });
            } else {
                cGames = await CheckedGames.create({
                    accepted: false,
                    users_id: users_id,
                    info_games_id: info_games_id
                });
            }

            // Добавление предупреждения определённой игре
            await Warnings.create({
                checked_games_id: cGames.id,
                reason: reason
            });

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_game_warning,
                message: 'Добавления предупреждения игре',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, accepted: true });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_game_warning,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/game/ban
router.post(                                // бан игры не соответствующей определённым требованиям
    address_config.f_moderator_game_ban,
    [
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('info_games_id', "Некорректный идентификатор игры").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_ban,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при одобрении игры"
                });
            }

            const { users_id, access_token, info_games_id, reason } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_games_queue,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_ban,
                    message: 'Попытка выдача блокировки для игры неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для выдачи блокировки игре необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_ban,
                    message: "Попытка выдачи блокировки игре пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queue = await QueueGamesCheck.findOne({
                info_games_id: info_games_id
            });

            // Если игра в очереди, то её необходимо оттуда убрать
            if (queue) {
                await queue.destroy();
            }

            const checkedGames = await CheckedGames.findOne({
                where: {
                    users_id: users_id,
                    info_games_id: info_games_id
                }
            });

            // Добавление метки "не одобрено" на текущую игру
            let cGames = null;
            if (checkedGames) {
                cGames = await checkedGames.update({
                    accepted: false
                });
            } else {
                cGames = await CheckedGames.create({
                    accepted: false,
                    users_id: users_id,
                    info_games_id: info_games_id
                });
            }

            // Добавление бана к игре
            await Bans.create({
                checked_games_id: cGames.id,
                reason: reason
            });

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_game_ban,
                message: 'Добавления блокировки игре',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, accepted: true });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_game_ban,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/moderator/game/unban
router.post(                                // разблокировка игры, которая ранее была заблокирована
    address_config.f_moderator_game_unban,
    [
        check('users_id', "Некорректный идентификатор пользователя").isInt(),
        check('info_games_id', "Некорректный идентификатор игры").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            
            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_unban,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при одобрении игры"
                });
            }

            const { users_id, access_token, info_games_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_unban,
                    message: "Для просмотра очереди игр необходимо авторизоваться",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра очереди игр необходимо авторизоваться" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_unban,
                    message: 'Попытка разблокировки игры неавторизованным пользователем',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для разблокировки игры необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "moderator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_moderator_game_unban,
                    message: "Попытка разблокировки игры пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const queue = await QueueGamesCheck.findOne({
                info_games_id: info_games_id
            });

            // Если игра в очереди, то её необходимо оттуда убрать
            if (queue) {
                await queue.destroy();
            }

            const checkedGames = await CheckedGames.findOne({
                where: {
                    users_id: users_id,
                    info_games_id: info_games_id
                }
            });

            // Добавление метки "не одобрено" на текущую игру
            let cGames = null;
            if (checkedGames) {
                cGames = await checkedGames.update({
                    accepted: false
                });
            } else {
                cGames = await CheckedGames.create({
                    accepted: false,
                    users_id: users_id,
                    info_games_id: info_games_id
                });
            }

            // Удаление всех банов для игры
            await Bans.destroy({
                where: {
                    checked_games_id: cGames.id
                }
            })

            logger.info({
                method: 'POST',
                address: address_config.function_moderator_game_unban,
                message: 'Разблокировка',
                data: {
                    users_id
                }
            });
            res.status(201).json({ "errors": null, "message": null, accepted: true });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_moderator_game_unban,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

module.exports = router;