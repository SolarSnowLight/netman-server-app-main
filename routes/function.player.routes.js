//-----------------------------------------------------------------------------------------
//Маршрутизация для функционального модуля "Игрок"
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
    Marks, CurrentGames, FixJudges, CompleteGames,
    GamesQuests, GameFinished, JudgeScore, Sequelize,
    CheckedGames, VideoShooters, Games, Tokens
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); //проверка токена
const authMiddleware = require('../middlewares/auth-middleware');

Array.prototype.removeIf = function (callback) {
    var i = this.length;
    while (i--) {
        if (callback(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

Array.prototype.removeIfAsync = async function (callback) {
    var i = this.length;
    while (i--) {
        if (await callback(this[i], i)) {
            this.splice(i, 1);
        }
    }
};

router.get(
    '/info/info',
    async (req, res) => {
        try{
            console.log(req.headers.authorization);
            return res.status(201).json({
                data: "Hello, world!"
            });
        }catch(e){
            console.log(e);
        }
    }
)

//prefix: /function/player/game/status
router.post(                                 // Получение информации о статусе игрока
    address_config.f_player_game_status,
    [
        authMiddleware,
        check("users_id", "Некорректный идентификатор пользователя").isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_game_status,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Не корректные данные при передачи данных на сервер"
                });
            }

            const { users_id } = req.body;

            const fixedJudges = await FixJudges.findOne({
                where: {
                    users_id: users_id
                }
            });

            if (fixedJudges) {
                return res.status(201).json({
                    "errors": null,
                    "message": null,
                    judge: true,
                    player: false
                });
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: users_id
                }
            });

            if (!dataPlayers) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_game_status,
                    message: 'Информации о данном игроке нет в базе данных',
                    date: {
                        users_id
                    }
                });

                return res.status(201).json({
                    errors: null,
                    message: "Информации о данном игроке нет"
                });
            }

            if (!dataPlayers.commands_id) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_game_status,
                    message: 'Данный игрок не имеет команду',
                    date: {
                        users_id
                    }
                });

                return res.status(201).json({
                    errors: null,
                    message: "Данный игрок не имеет команду"
                });
            }

            const commands = await Commands.findOne({
                where: {
                    id: dataPlayers.commands_id
                }
            });

            const currentGames = await CurrentGames.findOne({
                where: {
                    commands_id: commands.name,
                }
            });

            if (!currentGames) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_game_status,
                    message: 'У данного игрока нет текущей игры',
                    date: {
                        users_id
                    }
                });
                return res.status(201).json({
                    errors: null,
                    message: "У данного игрока нет текущей игры",
                    player: false, judge: false
                });
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_game_status,
                message: 'Получение информации о текущей игре для отдельного игрока',
            });

            res.status(201).json({
                "errors": null, "message": null,
                player: true, judge: false
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_game_status,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/games
router.post(                                 // Получение информации обо всех играх, которые существуют в настоящее время
    address_config.f_player_games,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_games,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Не корректные данные при передачи данных на сервер"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_games,
                    message: "Нет доступа",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нет доступа" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_games,
                    message: 'Попытка получения информации обо всех играх незарегистрированным пользователем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const data = await InfoGames.findAll({
                attributes: ['id', 'name', 'max_count_commands',
                    'date_begin', 'date_end', 'age_limit',
                    'type', 'rating', 'min_score', 'users_id'
                ]
            });

            //логика определения всех доступных игр в текущее время (определяется на стороне сервера)
            //.......................................................................................
            const games = [];
            for (let i = 0; i < data.length; i++) {
                if ((new Date(data[i].date_end)) > (new Date())) {
                    games.push(data[i]);
                }
            }

            for (let i = 0; i < games.length; i++) {
                //определение числа команд, которые уже зарегистрированы на данную игру
                const count_register = await RegisterCommands.count({ where: { current_game: games[i].id } });
                games[i].dataValues.count_register_commands = count_register;

                //определение никнеймов создателей игр
                const findingData = await PersonalData.findOne({ where: { users_id: games[i].users_id } });
                games[i].dataValues.nickname_creator = findingData.nickname;
            }
            //.......................................................................................

            logger.info({
                method: 'POST',
                address: address_config.function_player_games,
                message: 'Получение информации о всех играх',
            });

            res.status(201).json({ "errors": null, "message": null, "data": games });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_games,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/info
router.post(                         // Получение информации о конкретном игроке
    address_config.f_player_info,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.functiona_player_info,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Не корректные данные при передачи данных на сервер"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'GET',
                    address: address_config.function_player_info,
                    message: "Попытка обращения к модулю не авторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка обращения к модулю не авторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_info,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const data = await PersonalData.findOne({ where: { users_id: users_id } });
            data.dataValues.data_players = (await DataPlayers.findOne({
                where: {
                    users_id: users_id
                }
            }));
            data.dataValues.email = candidat.email;

            logger.info({
                method: 'POST',
                address: address_config.function_player_info,
                message: 'Получение информации о пользователе',
            });

            res.status(201).json({ "errors": null, "message": null, ...data.dataValues });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_info,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/info/update
router.post(                                // Обновление персональных данных пользователя
    address_config.f_player_info_update,
    [
        authMiddleware,
        check('new_email', 'Введите корректный email').isEmail(),
        check('old_email', 'Введите корректный email').isEmail(),
        check('phone_num', 'Некорректный номер телефона').isMobilePhone("ru-RU"),
        /*check('location', 'Максимальная длина местоположение не может быть меньше 3 символов')
            .isLength({ min: 3 }),*/
        check('nickname', 'Минимальная длина для никнейма равна 2 символам')
            .isLength({ min: 2 }),
        check('name', 'Минимальная длина для имени равна 2 символам')
            .isLength({ min: 2 }),
        check('surname', 'Минимальная длина для фамилии равна 2 символам')
            .isLength({ min: 2 }),
        check('users_id', 'Некорректный идентификатор пользователя').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_info_update,
                    message: 'Ошибка при валидации входных данных [обновление персональных данных]',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, old_email, new_email, name,
                surname, nickname, phone_num, location,
                date_birthday, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_info_update,
                    message: e.message,
                    date: {
                        new_email: new_email,
                        old_email: old_email,
                        name: name,
                        surname: surname,
                        nickname: nickname,
                        phone_num: phone_num,
                        location: location,
                        date_birthday: date_birthday
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Неавторизованный пользователь не может вносить изменения" });
            }

            const candidat = await User.findOne({ where: { id: users_id, email: old_email } });
            const candidatNew = await User.findOne({ where: { email: new_email } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_info_update,
                    message: 'Попытка обновления персональных данных не авторизованным пользователем',
                    date: {
                        email: old_email
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь незарегистрирован" });
            }

            if ((candidat) && (candidatNew) && (candidat.id != candidatNew.id)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_info_update,
                    message: 'Попытка обновления персональных данных при которой новый email уже существует',
                    date: {
                        email: old_email
                    }
                });
                return res.status(201).json({ "errors": null, "message": `Почтовый адрес ${new_email} уже существует` });
            }

            let updateValuesPersonalData = {
                name: name,
                surname: surname,
                nickname: nickname,
                phone_num: phone_num,
                //location: location,
                //date_birthday: date_birthday
            }

            // Обновление персональных данных пользователя
            await PersonalData.update(updateValuesPersonalData, { where: { users_id: users_id } });

            if ((candidat) && (!candidatNew)) {
                candidat.email = new_email;
                await candidat.update();
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_info_update,
                message: 'Обновление данных пользователя',
                date: {
                    new_email: new_email,
                    old_email: old_email,
                    name: name,
                    surname: surname,
                    nickname: nickname,
                    phone_num: phone_num,
                    location: location,
                    date_birthday: date_birthday
                }
            });
            res.status(201).json({ "errors": null, "message": null, update: true });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_info_update,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/statistics
router.post(                             // Получение игровой статистики конкретного пользователя
    address_config.f_player_statistics,
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
                    address: address_config.function_player_info_update,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_statistics,
                    message: "Попытка получения статистики неавторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения статистики неавторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_statistics,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const dataPlayer = await DataPlayers.findOne({ where: { users_id: users_id } });
            let ratingCommand = 0;

            if (dataPlayer.commands_id) {
                const dataCommand = await Commands.findOne({ where: { id: dataPlayer.commands_id } });
                ratingCommand = dataCommand.rating;
            }

            const result = {
                rating_player: dataPlayer.rating,
                rating_command: ratingCommand
            };

            logger.info({
                method: 'POST',
                address: address_config.function_player_statistics,
                message: 'Получение статистики игрока',
            });

            res.status(201).json({ "errors": null, "message": null, ...result });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_statistics,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command
router.post(                             // Получение информации о команде игрока
    address_config.f_player_command,
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
                    address: address_config.function_player_command,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: "Попытка получения информации о команде неавторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения информации о команде неавторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const dataPlayer = await DataPlayers.findOne({ where: { users_id: users_id } });

            if (!dataPlayer.commands_id) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: 'Данный пользователь не имеет команды',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет команды" });
            }

            const dataCommand = await Commands.findOne({ where: { id: dataPlayer.commands_id } });

            const countPlayers = (await DataPlayers.findAll({
                where: {
                    commands_id: dataCommand.id
                }
            })).length;

            const commandLocation = (await PersonalData.findOne({
                where: {
                    users_id: dataCommand.users_id
                }
            })).location;

            logger.info({
                method: 'POST',
                address: address_config.function_player_command,
                message: 'Получение информации о команде игрока',
            });

            res.status(201).json({
                "errors": null, "message": null,
                ...dataCommand.dataValues,
                count_players: countPlayers,
                location: commandLocation
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/players
router.post(                             //получение информации о игроках в команде
    address_config.f_player_command_players,
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
                    address: address_config.function_player_command_players,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, commands_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: "Попытка получения информации о команде неавторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения информации о команде неавторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_players,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            let commandsId = commands_id;

            if (!commands_id) {
                const dataPlayer = await DataPlayers.findOne({ where: { users_id: users_id } });

                if (!dataPlayer.commands_id) {
                    logger.error({
                        method: 'POST',
                        address: address_config.function_player_command_players,
                        message: 'Данный пользователь не имеет команды',
                        data: {
                            users_id
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет команды" });
                }

                commandsId = dataPlayer.commands_id;
            }

            const dataCommand = await Commands.findOne({ where: { id: commandsId } });
            const dataUsersCommand = await DataPlayers.findAll({
                attributes: ['users_id', 'commands_id', 'rating']
            });

            const usersCommand = [];
            dataUsersCommand.forEach((item) => {
                if (item.commands_id === dataCommand.id) {
                    usersCommand.push(item);
                }
            });

            // Получение персональных данных каждого игрока, который принадлежит данной команде
            const usersPersonalCommand = [];
            for (let i = 0; i < usersCommand.length; i++) {
                const value = await PersonalData.findOne({ where: { users_id: usersCommand[i].users_id } });
                usersPersonalCommand.push({
                    ...value.dataValues,
                    rating: usersCommand[i].rating,
                    creator: (value.users_id === dataCommand.users_id)
                });
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_players,
                message: 'Получение информации о команде игрока',
            });

            res.status(201).json({
                "errors": null, "message": null,
                "users": usersPersonalCommand
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_players,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/current/game
router.post(                             // Получение информации о текущей игре, на которую зарегистрирована команда
    address_config.f_player_command_current_game,
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
                    address: address_config.function_player_command_current_game,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, commands_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_game,
                    message: "Попытка получения информации о команде неавторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения информации о команде неавторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_game,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            let commandsId = commands_id;

            if (!commands_id) {
                const dataPlayer = await DataPlayers.findOne({ where: { users_id: users_id } });

                if (!dataPlayer.commands_id) {
                    logger.error({
                        method: 'POST',
                        address: address_config.function_player_command_current_game,
                        message: 'Данный пользователь не имеет команды',
                        data: {
                            users_id
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет команды" });
                }

                commandsId = dataPlayer.commands_id;
            }

            const dataCommand = await Commands.findOne({ where: { id: commandsId } });

            if (!dataCommand) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_game,
                    message: 'Данный пользователь не имеет команды',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "У Вас нет команды для просмотра её текущей игры!" });
            }

            const dataRegisterGames = await RegisterCommands.findAll({
                where: {
                    commands_id: dataCommand.id,
                },

                include: {
                    model: InfoGames,
                    where: {
                        id: {
                            [Sequelize.Op.eq]: Sequelize.col("register_commands.info_games_id")
                        },
                        date_end: {
                            [Sequelize.Op.gte]: new Date()
                        }
                    }
                }
            });

            // Отсеивание игр, которые были завершены командой
            await dataRegisterGames.removeIfAsync(async (item) => {
                const isCompleted = await CompleteGames.findOne({
                    where: {
                        info_games_id: item.info_games_id,
                        commands_id: item.commands_id
                    }
                });

                return (isCompleted) ? true : false;
            });

            if (dataRegisterGames.length <= 0) {
                logger.info({
                    method: 'POST',
                    address: address_config.function_player_command_current_game,
                    message: 'Никаких игр на данный момент у команды нет',
                });

                return res.status(201).json({
                    "errors": null, "message": null
                });
            }

            const currentGame = await InfoGames.findOne({
                where: {
                    id: dataRegisterGames[0].info_games_id
                }
            });

            currentGame.dataValues.count_quests = (await GamesQuests.findAll({
                where: {
                    info_games_id: currentGame.id
                }
            })).length;

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_current_game,
                message: 'Получение информации о текущей игре команды',
            });

            res.status(201).json({
                "errors": null, "message": null,
                ...currentGame.dataValues
            });
        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_current_game,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/games
router.post(                             //получение информации обо всех пройденных играх командой
    address_config.f_player_command_games,
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
                    address: address_config.function_player_command_games,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, commands_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: "Попытка получения информации о команде неавторизованного пользователя",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения информации о команде неавторизованного пользователя" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_games,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            let commandsId = commands_id;
            if (!commands_id) {
                const dataPlayer = await DataPlayers.findOne({ where: { users_id: users_id } });

                if (!dataPlayer.commands_id) {
                    logger.error({
                        method: 'POST',
                        address: address_config.function_player_command_games,
                        message: 'Данный пользователь не имеет команды',
                        data: {
                            users_id
                        }
                    });
                    return res.status(201).json({ "errors": null, "message": "Данный пользователь не имеет команды" });
                }

                commandsId = dataPlayer.commands_id;
            }

            const dataCommand = await Commands.findOne({ where: { id: commandsId } });
            const completeGames = await CompleteGames.findAll({
                where: {
                    commands_id: dataCommand.id,
                    completed: true
                }
            });

            const infoGames = [];
            for (let i = 0; i < completeGames.length; i++) {
                const value = await InfoGames.findOne({
                    where: {
                        id: completeGames[i].info_games_id
                    }
                });

                if (value) {
                    value.dataValues.count_quests = (await GamesQuests.findAll({
                        where: {
                            info_games_id: value.id
                        }
                    })).length;

                    infoGames.push(value);
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_games,
                message: 'Получение информации о текущей игре команды',
            });

            res.status(201).json({
                "errors": null, "message": null,
                "games": infoGames
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_games,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/commands/list
router.post(                             // Получение информации о всех командах, которые зарегистрированы
    address_config.f_player_commands_list,
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
                    address: address_config.function_player_commands_list,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_commands_list,
                    message: "Попытка получения информации о командах неавторизованным пользователем",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Попытка получения информации о командах неавторизованным пользователем" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const commands = await Commands.findAll();
            for (let i = 0; i < commands.length; i++) {
                commands[i].dataValues.count_players = (await DataPlayers.findAll({
                    where: {
                        commands_id: commands[i].id
                    }
                })).length;

                const commandLocation = (await PersonalData.findOne({
                    where: {
                        users_id: commands[i].users_id
                    }
                })).location;

                commands[i].dataValues.location = commandLocation;
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_commands_list,
                message: 'Получение информации о всех командах',
            });

            res.status(201).json({
                "errors": null, "message": null,
                commands: commands
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_commands_list,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/join
router.post(                             //получение информации о всех командах, которые зарегистрированы
    address_config.f_player_command_join,
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
                    address: address_config.function_player_command_join,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, commands_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join,
                    message: "Попытка присоединения неавторизованного игрока к команде",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для присоединения к команде необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const command = await Commands.findOne({
                where: {
                    id: commands_id
                }
            });

            if (!command) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join,
                    message: 'Данной команды не существует',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данной команды не существует" });
            }

            const isCurrentGame = await CurrentGames.findOne({
                where: {
                    commands_id: commands_id
                }
            });

            if (isCurrentGame) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join,
                    message: 'Попытка присоединения к команде, когда у неё имеется текущая игра',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нельзя присоединится к команде, когда у неё есть текущая игра!" });
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: users_id
                }
            });

            if (!dataPlayers) {
                const countPlayers = (await DataPlayers.findAll({
                    where: {
                        commands_id: commands_id
                    }
                })).length;

                await DataPlayers.create({
                    rating: 0,
                    users_id: users_id,
                    commands_id: commands_id
                });

                if (countPlayers === 0) {
                    const currentCommand = await Commands.findOne({
                        where: {
                            id: commands_id
                        }
                    });

                    await currentCommand.update({
                        users_id: users_id
                    });
                }
            } else {
                const countPlayers = (await DataPlayers.findAll({
                    where: {
                        commands_id: commands_id
                    }
                })).length;

                await dataPlayers.update({
                    commands_id: commands_id
                });

                if (countPlayers === 0) {
                    const currentCommand = await Commands.findOne({
                        where: {
                            id: commands_id
                        }
                    });

                    await currentCommand.update({
                        users_id: users_id
                    });
                }

                if (command.users_id === users_id) {
                    // Если игрок, который решил поменять команду - создатель, то полномочия создателя передаются
                    // следующему за создетелем игроку по списку, а если игроков нет - информация о команде будет удалена

                    const lastPlayer = await DataPlayers.findOne({
                        where: {
                            commands_id: commands_id
                        }
                    });

                    if (lastPlayer) {
                        await command.update({
                            users_id: lastPlayer.users_id
                        });
                    } else {
                        // Удаление информации о команде
                        // [Здесь подразумевалось удаление, возможно алгоритм будет пересмотрен]
                        /*await RegisterCommands.destroy({
                            where: {
                                commands_id: commands_id
                            }
                        });

                        await CurrentGames.destroy({
                            where: {
                                commands_id: commands_id
                            }
                        });

                        await CompleteGames.destroy({
                            where: {
                                commands_id: commands_id
                            }
                        });

                        const games = await Games.findAll({
                            where: {
                                commands_id: commands_id
                            }
                        });

                        if (games.length > 0) {
                            const gameFinisheds = await GameFinished.findAll({
                                where: {
                                    game_id: {
                                        [Sequelize.Op.in]: games.map((item) => item.id)
                                    }
                                }
                            });

                            await JudgeScore.destroy({
                                where: {
                                    game_finished_id: gameFinisheds.map((item) => item.id)
                                }
                            });

                            await FixJudges.destroy({
                                where: {
                                    commands_id: commands_id
                                }
                            });

                            await GameFinished.destroy({
                                where: {
                                    game_id: {
                                        [Sequelize.Op.in]: games.map((item) => item.id)
                                    }
                                }
                            });
                        }

                        await Games.destroy({
                            where: {
                                commands_id: commands_id
                            }
                        });*/
                    }
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_join,
                message: 'Присоединение игрока к команде',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                join: true
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_join,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/detach
router.post(                             // Выход игрока из команды
    address_config.f_player_command_detach,
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
                    address: address_config.function_player_command_detach,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, commands_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_detach,
                    message: "Попытка выхода из команды неавторизованным игроком",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для выхода из команды необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_detach,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const command = await Commands.findOne({
                where: {
                    id: commands_id
                }
            });

            if (!command) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_detach,
                    message: 'Данной команды не существует',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данной команды не существует" });
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: users_id
                }
            });

            if (!dataPlayers) {
                await DataPlayers.create({
                    rating: 0,
                    users_id: users_id,
                    commands_id: null
                });
            } else if (dataPlayers.commands_id) {
                await dataPlayers.update({
                    commands_id: null
                });

                if (command.users_id === users_id) {
                    const lastPlayer = await DataPlayers.findOne({
                        where: {
                            commands_id: commands_id
                        }
                    });

                    if (lastPlayer) {
                        await command.update({
                            users_id: lastPlayer.users_id
                        });
                    } else {
                        // Удаление информации о команде
                        // [Здесь подразумевалось удаление, возможно алгоритм будет пересмотрен]
                    }
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_detach,
                message: 'Выход игрока из команды',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                detach: true
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_detach,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/create
router.post(                             // Создание команды определённым игроком
    address_config.f_player_command_create,
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
                    address: address_config.function_player_command_create,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token, name } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_create,
                    message: "Попытка создания команды неавторизованным игроком",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для создания команды необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_detach,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const command = await Commands.findOne({
                where: {
                    name: name
                }
            });

            if (command) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_create,
                    message: 'Команда с данным названием уже существует!',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Команда с данным названием уже существует!" });
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: users_id
                }
            });

            if (dataPlayers.commands_id) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_create,
                    message: 'Данный пользователь уже состоит в команде!',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для создания команды необходимо выйти из уже существующей команды!" });
            }

            const commandInfo = await Commands.create({
                name: name,
                users_id: users_id,
                date_register: new Date(),
                rating: 0
            });

            await dataPlayers.update({
                commands_id: commandInfo.id
            });

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_create,
                message: 'Создание новой команды!',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                create: true
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_create,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/register/game
router.post(                             // Регистрации команду на игру определённым игроком
    address_config.f_player_command_register_game,
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
                    address: address_config.function_player_command_register_game,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, info_games_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: "Попытка создания команды неавторизованным игроком",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для создания команды необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const command = await Commands.findOne({
                where: {
                    users_id: users_id
                },

                include: {
                    model: DataPlayers,
                    where: {
                        users_id: users_id,
                        commands_id: {
                            [Sequelize.Op.eq]: Sequelize.col("commands.id")
                        }
                    }
                }
            });

            if (!command) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Попытка регистрации на игру пользователем, который не является создателем ни одной команды',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для регистрации команды на игру необходимо быть создателем команды!" });
            }

            const countPlayers = await DataPlayers.count({
                where: {
                    commands_id: command.id
                }
            });

            if (countPlayers < 3) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Попытка регистрации на игру команды, количество участников которой меньше трех',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для регистрации команды на игру необходимо чтобы в команде было не менее 3-х и не более 6-ти участников! " });
            }

            // Проверка информации об игре
            const infoGame = await InfoGames.findOne({
                where: {
                    id: info_games_id,
                    date_begin: {
                        [Sequelize.Op.gte]: new Date()
                    }
                },

                include: {
                    model: CheckedGames,
                    where: {
                        info_games_id: info_games_id,
                        accepted: true
                    }
                }
            });

            if (!infoGame) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Попытка регистрации на игру, которая не доступна',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данная игра не доступна для регистрации" });
            }

            // Поиск игры, на которую команда уже была зарегистрирована
            const registerGames = await RegisterCommands.findOne({
                where: {
                    commands_id: command.id,
                },

                include: {
                    model: InfoGames,
                    where: {
                        id: {
                            [Sequelize.Op.eq]: Sequelize.col('register_commands.info_games_id')
                        },
                        date_begin: {
                            [Sequelize.Op.gte]: new Date()
                        }
                    }
                }
            });

            const isCompletedGames = (registerGames) ? await CompleteGames.findOne({
                where: {
                    commands_id: registerGames.commands_id,
                    info_games_id: registerGames.info_games_id
                }
            }) : false;

            if ((registerGames) || (isCompletedGames)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Попытка регистрации на игру, когда команда уже прошла данную игру',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Команда уже проходила данную игру!" });
            }

            const currentGame = await CurrentGames.findOne({
                where: {
                    commands_id: command.id,
                    info_games_id: infoGame.id
                }
            });

            if (currentGame) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_register_game,
                    message: 'Попытка регистрации на игру, когда команда уже имеет текущую игру',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Команда уже имеет текущую игру!" });
            }

            // Регистрация команды на игру
            await RegisterCommands.create({
                commands_id: command.id,
                info_games_id: info_games_id
            });

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_register_game,
                message: 'Регистрация команды на определённую игру',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
            });

        } catch (e) {
            console.log(e);
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_register_game,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/available/games
router.post(                             // получение списка всех доступных игр
    address_config.f_player_command_available_games,
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
                    address: address_config.function_player_command_available_games,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_available_games,
                    message: "Попытка просмотра списка доступных игр не авторизованным пользователем",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка доступных игр необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_available_games,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            // Все игры, которые удовлетворяют условию доступности в рамках игрового процесса
            const infoGames = await InfoGames.findAll({
                where: {
                    date_begin: {
                        [Sequelize.Op.gte]: new Date()
                    }
                },

                include: {
                    model: CheckedGames,
                    where: {
                        info_games_id: {
                            [Sequelize.Op.eq]: Sequelize.col('info_games.id')
                        },
                        accepted: true
                    }
                }
            });

            // Удаление игр, которые уже заполнены другими командами
            infoGames.removeIfAsync(async (item, idx) => {
                const countCommand = await RegisterCommands.count({
                    where: {
                        info_games_id: item.id
                    }
                });

                if (countCommand >= item.max_count_commands) {
                    return true;
                }

                return false;
            });

            for (let i = 0; i < infoGames.length; i++) {
                const countQuest = await GamesQuests.count({
                    where: {
                        info_games_id: infoGames[i].dataValues.id
                    }
                });

                infoGames[i].dataValues.count_quests = countQuest;
                infoGames[i].dataValues.checked_games = undefined;
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_available_games,
                message: 'Получение списка доступных игр',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                info_games: infoGames
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_available_games,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/free/list/tag
router.post(                             // Получение списка свободных игроков по тэгу
    address_config.f_player_command_free_list_tag,
    [
        check('users_id', 'Некорректный идентификатор пользователя').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_free_list_tag,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, tag, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_free_list_tag,
                    message: "Попытка просмотра списка доступных игр не авторизованным пользователем",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка доступных игр необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_free_list_tag,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            // Список всех свободных пользователей
            const freeAllPlayers = await DataPlayers.findAll({
                attributes: ["users_id", "rating"],
                where: {
                    commands_id: {
                        [Sequelize.Op.eq]: null
                    }
                }
            });

            const freePlayers = [];

            for (let i = 0; i < freeAllPlayers.length; i++) {
                const dplayer = await PersonalData.findOne({
                    attributes: ["name", "surname", "nickname", "date_birthday", "ref_image", "location"],
                    where: {
                        users_id: freeAllPlayers[i].users_id,
                    }
                });

                if ((dplayer) && (
                    (dplayer.name.includes(tag))
                    || (dplayer.surname.includes(tag))
                    || (dplayer.nickname.includes(tag))
                )) {
                    freeAllPlayers[i].dataValues.data_player = undefined;
                    freeAllPlayers[i].dataValues.commands_id = undefined;
                    freePlayers.push(Object.assign(freeAllPlayers[i].dataValues, dplayer.dataValues))
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_free_list_tag,
                message: 'Получение списка свободных игроков',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                free_players: freePlayers
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_free_list_tag,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/join/certain
router.post(                             // Присоединение игрока к команде
    address_config.f_player_command_join_certain,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
        check('player_users_id', 'Некорректный идентификатор приглашаемого пользователя').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, player_users_id, commands_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: "Попытка просмотра списка доступных игр не авторизованным пользователем",
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка доступных игр необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } }),
                playerCandidat = await User.findOne({ where: { id: player_users_id } });

            if ((!candidat) || (!playerCandidat)) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id,
                        player_users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const command = await Commands.findOne({
                where: {
                    users_id: users_id,
                    id: commands_id
                }
            });

            if (!command) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Попытка добавления игрока в команду, в которой добавляющий не является создателем',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Только создатель команды может добавить игрока в команду!" });
            }

            const currentGame = await CurrentGames.findOne({
                where: {
                    commands_id: command.id
                }
            });

            if (currentGame) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Попытка добавления игрока в команду, у которой есть незавершённая игра',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нельзя добавить игрока в команду, когда началась игра!" });
            }

            const countDataPlayers = await DataPlayers.count({
                where: {
                    commands_id: command.id
                }
            });

            if (countDataPlayers >= 6) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Попытка добавления в команду более 6-ти человек',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Нельзя добавить игроков в команду, состоящую из 6-ти игроков!" });
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: player_users_id,
                    commands_id: {
                        [Sequelize.Op.eq]: null
                    }
                }
            });

            if (!dataPlayers) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_join_certain,
                    message: 'Попытка добавления игрока в команду, который уже состоит в другой команде',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный игрок уже состоит в команде!" });
            }

            // Обновление команды у пользователя
            await dataPlayers.update({
                commands_id: command.id
            });

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_join_certain,
                message: 'Добавление игрока в команду',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_join_certain,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/find/certain
router.post(                             // Получение списка определенных пользователей по тэгу
    address_config.f_player_find_certain,
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
                    address: address_config.function_player_find_certain,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, tag, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_find_certain,
                    message: "Попытка просмотра списка пользователей не авторизованным пользователем",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для просмотра списка пользователей необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_find_certain,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            // Список всех свободных пользователей
            const freeAllPlayers = await DataPlayers.findAll({
                attributes: ["users_id", "rating"],
                where: {
                    users_id: {
                        [Sequelize.Op.ne]: users_id
                    }
                }
            });

            const freePlayers = [];

            for (let i = 0; i < freeAllPlayers.length; i++) {
                const dplayer = await PersonalData.findOne({
                    attributes: ["name", "surname", "nickname", "date_birthday", "ref_image", "location"],
                    where: {
                        users_id: freeAllPlayers[i].users_id,
                    }
                });

                if ((dplayer) && (
                    (dplayer.name.includes(tag))
                    || (dplayer.surname.includes(tag))
                    || (dplayer.nickname.includes(tag))
                )) {
                    freeAllPlayers[i].dataValues.data_player = undefined;
                    freeAllPlayers[i].dataValues.commands_id = undefined;
                    freePlayers.push(Object.assign(freeAllPlayers[i].dataValues, dplayer.dataValues))
                }
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_find_certain,
                message: 'Получение списка пользователей',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                free_players: freePlayers
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_find_certain,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/current/media/instructions
router.post(                             // Текущая видео инструкция
    address_config.f_player_command_current_media_instructions,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
        check('quests_id', 'Некорректный идентификатор квеста').isInt()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_media_instructions,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, quests_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_media_instructions,
                    message: "Попытка получения информации о медиафайле, который необходимо загрузить",
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Для выполнения действия необходима авторизация" });
            }

            const candidat = await User.findOne({ where: { id: users_id } });

            if (!candidat) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_media_instructions,
                    message: 'Данный пользователь не зарегистрирован',
                    data: {
                        id: users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            const quests = await Quests.findOne({
                where: {
                    id: quests_id
                }
            });

            if (!quests) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_current_media_instructions,
                    message: 'Данного квеста не существует',
                    data: {
                        users_id
                    }
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован" });
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_current_media_instructions,
                message: 'Получение информации о загружаемом медиафайле',
                data: {
                    users_id
                }
            });

            res.status(201).json({
                "errors": null, "message": null,
                ref_media: quests.ref_media
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_current_media_instructions,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/command/add/result
router.post(                             // добавление результата выполнения игры
    address_config.f_player_command_add_result,
    [
        authMiddleware,
        check('game_id', 'Некорректный идентификатор пользователя').isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_add_result,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { ref_media, access_token, game_id } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_add_result,
                    message: "Попытка получения информации о медиафайле, который необходимо загрузить",
                });
                return res.status(201).json({ "errors": null, "message": "Для выполнения действия необходима авторизация" });
            }

            const videoShooters = await VideoShooters.findOne({
                where: {
                    games_id: game_id
                }
            });

            if (!videoShooters) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_command_add_result,
                    message: 'Данный пользователь не зарегистрирован в системе как оператор',
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован в системе как оператор" });
            }

            // Удаление
            await videoShooters.destroy();

            await GameFinished.create({
                game_id: game_id,
                ref_image: ref_media
            });

            logger.info({
                method: 'POST',
                address: address_config.function_player_command_add_result,
                message: 'Добавление результата',
            });

            res.status(201).json({
                "errors": null, "message": null,
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_command_add_result,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/judge/get/info
router.post(                             // Получение судьёй информации о выполненном квесте
    address_config.f_player_judge_get_info,
    [
        authMiddleware,
        check('users_id', 'Некорректный идентификатор пользователя').isInt(),
        check('info_games_id', 'Некорректный идентификатор игры').isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_get_info,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { users_id, info_games_id, commands_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_get_info,
                    message: "Необходима авторизация",
                });
                return res.status(201).json({ "errors": null, "message": "Необходима авторизация" });
            }

            const fixJudges = await FixJudges.findOne({
                where: {
                    users_id: users_id,
                    info_games_id: info_games_id,
                    commands_id: commands_id
                }
            });

            if (!fixJudges) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_get_info,
                    message: "Данный пользователь не состоит в списке судей",
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не состоит в списке судей" });
            }

            const commandData = await Commands.findOne({
                where: {
                    id: commands_id
                }
            });

            commandData.dataValues.count_players = await DataPlayers.count({
                where: {
                    commands_id: commands_id
                }
            });

            const infoGame = await InfoGames.findOne({
                where: {
                    id: info_games_id
                }
            });

            infoGame.dataValues.count_points = await GamesQuests.count({
                where: {
                    info_games_id: info_games_id
                }
            });

            const registerCommands = await RegisterCommands.findOne({
                where: {
                    info_games_id: info_games_id,
                    commands_id: commands_id
                }
            });

            const gamesFinisheds = await Games.findAll({
                where: {
                    commands_id: commands_id,
                    register_commands_id: registerCommands.id
                }
            });

            // Удаление всех игр, которые не были пройдены
            await gamesFinisheds.removeIfAsync(async (item) => {
                const gameFinish = await GameFinished.findOne({
                    where: {
                        game_id: item.id
                    }
                });

                item.dataValues.result_info = gameFinish;

                return (gameFinish) ? false : true;
            });

            for (let i = 0; i < gamesFinisheds.length; i++) {
                const questInfo = await Quests.findOne({
                    where: {
                        id: gamesFinisheds[i].dataValues.quests_id
                    }
                });

                gamesFinisheds[i].dataValues.quest_info = questInfo;
            }

            logger.info({
                method: 'POST',
                address: address_config.function_player_judge_get_info,
                message: 'Получение информации судъей',
            });

            res.status(201).json({
                "errors": null, "message": null,
                results_info: gamesFinisheds,
                info_game: infoGame,
                info_command: commandData
            });
        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_judge_get_info,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

//prefix: /function/player/judge/set/score
router.post(                             // Добавление оценки выполнения игры
    address_config.f_player_judge_set_score,
    [
        authMiddleware,
        check('score', 'Некорректные баллы для оценки').isInt(),
        check('game_finished_id', 'Некорректный идентификатор завершённого квеста').isInt(),
        check('fix_judges_id', 'Некорректный идентификатор судьи').isInt(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_set_score,
                    message: 'Ошибка при валидации входных данных',
                });
                return res.status(201).json({
                    errors: errors.array(),
                    message: "Некорректные данные при изменении данных пользователя"
                });
            }

            const { score, game_finished_id, fix_judges_id, access_token } = req.body;

            const result_verify = await checkTokenAccess(access_token);
            if (!result_verify) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_set_score,
                    message: "Попытка получения информации о медиафайле, который необходимо загрузить",
                });
                return res.status(201).json({ "errors": null, "message": "Для выполнения действия необходима авторизация" });
            }

            const judge = await FixJudges.findOne({
                where: {
                    id: fix_judges_id
                }
            });


            if (!judge) {
                logger.error({
                    method: 'POST',
                    address: address_config.function_player_judge_set_score,
                    message: 'Данный пользователь не зарегистрирован в системе как судья',
                });
                return res.status(201).json({ "errors": null, "message": "Данный пользователь не зарегистрирован в системе как судья" });
            }

            const isScoreExists = await JudgeScore.findOne({
                where: {
                    game_finished_id: game_finished_id,
                    fix_judges_id: fix_judges_id
                }
            });

            if (isScoreExists) {
                return res.status(201).json({ "errors": null, "message": "Вы уже дали оценку данной игре!" });
            }

            await JudgeScore.create({
                game_finished_id: game_finished_id,
                score: score,
                fix_judges_id: fix_judges_id
            });

            res.status(201).json({
                "errors": null, "message": null,
            });

        } catch (e) {
            logger.error({
                method: 'POST',
                address: address_config.function_player_judge_set_score,
                message: e.message,
            });
            res.status(201).json({ "errors": null, "message": "Ошибка при передачи данных, повторите попытку" });
        }
    });

module.exports = router;