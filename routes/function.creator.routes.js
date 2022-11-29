//-----------------------------------------------------------------------------------------
//Маршрутизация для функционального модуля "Креатор"
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
    Warnings, Bans,
    QueueGamesCheck, CheckedGames, GamesQuests,
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); // Проверка токена
const { checkAccessModule }
    = require('../checks/module.access');   // Проверка доступа к модулю
const authMiddleware = require('../middlewares/auth-middleware');

Array.prototype.removeIf = function (callback) {
    var i = this.length;
    while (i--) {
        if (callback(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

//prefix: /function/creator/games/add
router.post(                                // Создание новой игры
    address_config.f_creator_games_add,
    [
        authMiddleware,
        check('location', 'Максимальная длина местоположение не может быть меньше 3 символов')
            .isLength({ min: 3 }),
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
        check('min_score', 'Некорректные получаемые минимальные очки').isInt(),
        check('count_commands', 'Некорректное значения количества команд').isInt(),
        check('rating', 'Некорректное значение получаемого рейтинга').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { location, date_begin, date_end,
                type, rating, count_commands,
                min_score, age_limit, name, quests, access_token, users_id } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: 'Ошибка при валидации входных данных',
                    data: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: "Для добавления новых игр необходимо авторизоваться",
                    data: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для добавления новых игр необходимо авторизоваться" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: 'Попытка добавления новых заданий неавторизованным пользователем',
                    date: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для добавления новых заданий необходимо авторизоваться" });
            }

            const modules = await checkAccessModule(users_id, "creator");

            if (!modules) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: "Попытка добавление квестом пользователем, у которого нет доступа к функциональному модулю создателя",
                    date: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const db = new Date(date_begin);
            const de = new Date(date_end);

            if (db > de) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: "Дата завершения игры раньше даты начала игры",
                    date: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Дата завершения игры не может быть раньше даты начала игры" });
            }

            if (quests.length === 0) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_add,
                    message: "Нет квестов для создания игры",
                    date: {
                        location, date_begin, date_end,
                        type, rating, count_commands,
                        min_score, age_limit, name, quests
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для создания игры необходимо добавить квесты!" });
            }

            const idGame = await InfoGames.create({
                name: name,
                max_count_commands: count_commands,
                date_begin: date_begin,
                date_end: date_end,
                age_limit: age_limit,
                type: type,
                rating: rating,
                min_score: min_score,
                users_id: users_id,
                location: location
            });
                
            // Добавление новых квестов
            for (let i = 0; i < quests.length; i++) {
                const idQuest = await Quests.create({
                    task: quests[i].task,
                    hint: quests[i].hint,
                    radius: quests[i].radius,
                    ref_media: quests[i].ref_media,
                    marks_id: quests[i].marks_id,
                });

                await GamesQuests.create({
                    quests_id: idQuest.dataValues.id,
                    info_games_id: idGame.dataValues.id
                });
            }

            // Добавление игры в очередь проверки модераторами
            await QueueGamesCheck.create({
                info_games_id: idGame.id,
                date: new Date()
            });

            logger.info({
                method: 'POST',
                address: address_config.function_creator_games_add,
                message: 'Добавление нового задания',
                data: {
                    location, date_begin, date_end,
                    type, rating, count_commands,
                    min_score, age_limit, name, quests
                }
            });
            res.status(201).json({ "errors": null, "message": null, add: true });

        } catch (e) {
            console.log(e.message);
            logger.error({
                method: 'POST',
                address: address_config.function_creator_games_add,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/creator/games/created
router.post(                                // Получение информации о играх, которые были созданы
    address_config.f_creator_games_created,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            const { access_token, users_id } = req.body;

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_created,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при добавлении нового задания"
                });
            }

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_created,
                    message: "Получения списка созданных игр не авторизованным пользователем",
                });
                return res.status(201).json({ "errors": null, "message": "Для получения списка игр необходимо авторизоваться" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_created,
                    message: 'Попытка добавления новых заданий неавторизованным пользователем',
                });
                return res.status(201).json({ "errors": null, "message": "Для добавления новых заданий необходимо авторизоваться" });
            }

            const modules = await UserModules.findOne({ where: { users_id: users_id } });

            if ((!modules) || (modules.creator === false)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_created,
                    message: "Попытка получение информации о созданных играх пользователем, у которого нет к этой функции доступа",
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            // Получение информации обо всех играх, которые были созданы недавно
            const games = await InfoGames.findAll({ where: { users_id: users_id } });
            games.removeIf(function (item, idx) {
                return ((new Date(item.dataValues.date_end)) < (new Date));
            });

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
                address: address_config.function_creator_games_created,
                message: 'Получение списка созданных игр',
            });
            res.status(201).json({
                "errors": null, "message": null,
                games_created: games_created
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_creator_games_created,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/creator/games/delete
router.post(                                // Удаление определённой игры
    address_config.f_creator_games_delete,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
        check('info_games_id', 'Некорректный идентификатор игры').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при удалении задания"
                });
            }

            const { access_token, users_id, info_games_id } = req.body;

            /*const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_created,
                    message: "Получения списка созданных игр не авторизованным пользователем",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для получения списка игр необходимо авторизоваться" });
            }*/

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: 'Попытка удаления заданий неавторизованным пользователем',
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка удаления заданий неавторизованным пользователем" });
            }

            const modules = await UserModules.findOne({ where: { users_id: users_id } });

            if ((!modules) || (modules.creator === false)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: "Попытка удаление созданных игр пользователем, у которого нет к этой функции доступа",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const infoGames = await InfoGames.findOne({
                where: {
                    id: info_games_id,
                    users_id: users_id
                }
            });

            if (!infoGames) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: "Данная игра не присутствует в базе данных",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данная игра не присутствует в базе данных" });
            }

            const checkedGames = await CheckedGames.findOne({
                where: {
                    info_games_id: infoGames.id,
                    accepted: false
                }
            });

            const checkedAcceptGames = await CheckedGames.findOne({
                where: {
                    info_games_id: info_games_id,
                    accepted: true
                }
            });

            const queueGames = await QueueGamesCheck.findOne({
                where: {
                    info_games_id: info_games_id
                }
            });

            if (checkedAcceptGames) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: "Попытка удаления созданных игр, которые были одобрены",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нельзя удалить игры, которые были одобрены модератором!" });
            } else if ((!checkedGames) && (!queueGames)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_creator_games_delete,
                    message: "Попытка удаления созданных игр, данные о которых отсутствуют",
                    data: {
                        users_id, info_games_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нельзя удалить игры, информация о которых неизвестна!" });
            }

            /* Удаление игры из очереди, если она находится в очереди */
            if (queueGames) {
                await queueGames.destroy();
            }

            /* Удаление игры из очереди, если она не проверена модератором */
            if (checkedGames) {
                await Warnings.destroy({
                    where: {
                        checked_games_id: checkedGames.id
                    }
                });

                await Bans.destroy({
                    where: {
                        checked_games_id: checkedGames.id
                    }
                });

                await checkedGames.destroy();
            }

            /* Удаление информации обо всех квестах, привязанных к данной игре */
            const questsGames = await GamesQuests.findAll({
                where: {
                    info_games_id: infoGames.id
                }
            });

            for (let i = 0; i < questsGames.length; i++) {
                const quest = await Quests.findOne({
                    where: {
                        id: questsGames[i].quests_id
                    }
                });

                if (quest) {
                    /* Удаление соответствия квестов определённой игре */
                    await GamesQuests.destroy({
                        where: {
                            info_games_id: questsGames[i].info_games_id,
                            quests_id: quest.id
                        }
                    });

                    /* Удаление информации об определённом квесте */
                    await quest.destroy();
                }
            }

            /* Удаление информации о определённой игре */
            await infoGames.destroy();

            logger.info({
                method: 'POST',
                address: address_config.function_creator_games_delete,
                message: 'Удаление игры',
                data: {
                    users_id, info_games_id
                }
            });
            res.status(201).json({
                "errors": null, "message": null,
                delete: true
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_creator_games_delete,
                message: e.message,
            });
            console.log(e.message);
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });


module.exports = router;