//**************************************
// Работа серверной части приложения
//**************************************

const express = require('express');
const config = require("config");
const logger = require('./logger/logger');
const socket = require("socket.io");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const uidGenerator = require('node-unique-id-generator');
const token_access = require('./checks/token.access');
const errorMiddleware = require('./middlewares/error-middleware');
const {
    User, PersonalData, UserAttributes,
    UserModules, GroupAttributes, GroupModules,
    UserGroups, UserRoles, TaskMarks,
    DataPlayers, Commands, CoordPlayers,
    InfoGames, Quests, RegisterCommands,
    Marks, CurrentGames, FixJudges, Games,
    CheckedGames, GamesQuests, GameFinished,
    CompleteGames, VideoShooters,
    JudgeScore, Sequelize
} = require('./sequelize/models.js');
const { check } = require('express-validator');
const { info } = require('winston');
const mathCircle = require('./math/circle');
const webAppUrl = require('./config/web.app.url.json');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const app = express();
app.use(express.json({ extended: true }));              // Используется для корректного приёма данных в JSON формате
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: webAppUrl['web-app'].map((value) => {
        return value;
    })
}));
//определение основных маршрутов
app.use('/auth', require('./routes/auth.routes'));      // Авторизация
app.use('/sequrity',
    require('./routes/sequrity.routes'));               // Безопасность
app.use('/map', require('./routes/map.routes'));        // Взаимодействие с Google Maps API
app.use('/function/player',
    require('./routes/function.player.routes'));        // Функциональный модуль "Игрок"
app.use('/function/creator',
    require('./routes/function.creator.routes'));       // Функциональный модуль "Создатель" 
app.use('/function/moderator',
    require('./routes/function.moderator.routes'));     // Функциональный модуль "Модератор"
app.use(errorMiddleware);

const PORT = config.get('port') || 5000;                // Определение порта сервера

function start() {                                      // Функция для запуска серверной части приложения
    try {
        const data = app.listen(PORT, () => console.log(`Сервер запущен с портом ${PORT}`)); // Прослушивание запросов по определённому порту
        logger.info({
            port: (config.get('port') || 5000),
            message: "Запуск сервера"
        });
        return data;
    } catch (e) {
        logger.error({
            message: e.message
        });
        process.exit(1); // Выход из процесса
        return null;
    }
    return null;
}

const server = start();

const dataUsers = [];       // Глобальный объект, содержащий уникальные данные каждого пользователя
let gameProcess = true;     // Игровой процесс

const duExistsUser = (data, element) => {
    if ((!element.users_id)
        || (!element.access_token)
        || (!element.socket_id)
        || (!Array.isArray(data))
    ) {
        return false;
    }

    for (let i = 0; i < data.length; i++) {
        if ((data[i].users_id === element.users_id)
            && (data[i].socket_id === element.socket_id)) {
            return true;
        }
    }

    return false;
}

const duExistsValueIndex = (data, socket_id) => {
    if (!Array.isArray(data)) {
        return (-1);
    }

    for (let i = 0; i < data.length; i++) {
        if (data[i].socket_id === socket_id) {
            return i;
        }
    }

    return (-1);
}

const duGetIndexById = (data, id) => {
    if (!Array.isArray(data)) {
        return (-1);
    }

    for (let i = 0; i < data.length; i++) {
        if (data[i].users_id === id) {
            return i;
        }
    }

    return (-1);
}

// Функция ожидания
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Генерирование рандомного числа из диапазона [min; max]
const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
}

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

const io = socket(server);

/*
 * Правила добавления прослушивания определённых событий на сокеты:
 * 1) Уменьшить степень вложенности
 * 2) Каждая обработка должна быть максимально самостоятельна по 
 * отношению к базе данных. На практике было подтверждено то, что
 * когда на сервере или клиенте есть вложенные on, обрабатывающие
 * события, которые возникают часто, то это приводит к непоправимым
 * торможениям игрового процесса (исключение - глобальные объекты)
 */

io.on("connection", (socket) => {
    socket.on("authentication", async (data) => {
        try {
            // Аутентификация пользователя и занесение его в глобальный объект
            const user_data = JSON.parse(data);
            let checks = {
                token: false,
                exists: false
            };

            const exists = await User.findOne({
                where: {
                    id: user_data.users_id
                }
            });

            checks.exists = true; //await token_access.checkTokenAccess(user_data.users_email);
            checks.token = true; //await token_access.checkToken(user_data.token);

            if ((!checks.token) || (!checks.exists)) {
                socket.emit("authentication_failed");
                return;
            }

            if (duExistsUser(dataUsers, {
                socket_id: socket.id,
                users_id: user_data.users_id,
                access_token: user_data.access_token
            })) {
                socket.emit("authentication_failed");
                return;
            }

            dataUsers.push({
                users_id: user_data.users_id,
                socket_id: socket.id,
                access_token: user_data.access_token,
            });

            socket.emit("authentication_success");
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on authentication',
                message: e.message,
            });
        }
    });

    // Статус игрока
    socket.on("status", async () => {
        try {
            // Поиск пользователя из списка подключенных
            let index = duExistsValueIndex(dataUsers, socket.id);
            if (index < 0) {
                return;
            }

            // #################################### [comment='judge']
            // Данная версия обработки судейской позиции игрока была актуальна до
            // обнаружения бага на период 1-го тестирования 
            /* const judge = await FixJudges.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });
    
            // Проверка пользователя на принадлежность к судейскому составу
            if (judge) {
                socket.emit("status_on", JSON.stringify({
                    player: false,
                    judge: true,
                    player_status: 0
                }),
                    JSON.stringify({
                        ...judge.dataValues
                    })
                );
                socket.emit("clear_games_marks");
                // Подключение сокета на прослушивание сообщений для судей
    
                return;
            } */
            // #################################### [comment-end]

            // #################################### [judge]
            // Обработка определения судейский прав
            const judge = await FixJudges.findAll({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            // Отсеивание тех судейских записей, которые в данный момент не актуальны
            await judge.removeIfAsync(async (item) => {
                const isCompleted = await CompleteGames.findOne({
                    where: {
                        info_games_id: item.info_games_id,
                        commands_id: item.commands_id
                    }
                });

                const isGameEnding = await InfoGames.findOne({
                    where: {
                        id: item.info_games_id,
                        date_end: {
                            [Sequelize.Op.lt]: (new Date())
                        }
                    }
                });

                return (isCompleted || isGameEnding);
            });

            if (judge.length > 0) {
                socket.emit("status_on", JSON.stringify({
                    player: false,
                    judge: true,
                    player_status: 0
                }),
                    JSON.stringify({
                        ...judge[0].dataValues
                    })
                );
                socket.emit("clear_games_marks");
                // Подключение сокета на прослушивание сообщений для судей

                return;
            }
            // #################################### [judge-end]

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            if (!dataPlayers) {
                socket.emit("status_off", JSON.stringify({
                    player: false,
                    judge: false,
                    player_status: 0
                }));

                return;
            }

            if (!dataPlayers.commands_id) {
                socket.emit("status_on", JSON.stringify({
                    player: false,
                    judge: false,
                    player_status: 0
                }));

                // Отправка сообщения о том, что необходимо очистить
                // визуально представленную метку найденной игры
                socket.emit("clear_games_marks");

                return;
            }

            let playerStatus = 1;

            const video = await VideoShooters.findOne({
                where: {
                    data_players_id: dataPlayers.id
                }
            });

            if (video) {
                playerStatus = 2;
            }

            const currentGames = await CurrentGames.findOne({
                where: {
                    commands_id: dataPlayers.commands_id,
                }
            });

            if (!currentGames) {
                socket.emit("status_on", JSON.stringify({
                    player: false,
                    judge: false,
                    player_status: 0
                }));

                // Если текущей игры нет, то нет необходимости быть закреплённым за определённую комнату
                if (!(socket.rooms.has(dataPlayers.commands_id))) {
                    socket.leave(dataPlayers.commands_id);
                }
                socket.emit("clear_games_marks");

                return;
            } else {
                // Поиск регистрационной записи
                let registerGame = await RegisterCommands.findOne({
                    where: {
                        info_games_id: currentGames.info_games_id,
                        commands_id: currentGames.commands_id
                    }
                });

                // Поиск всех игр команды
                let games = await Games.findAll({
                    where: {
                        register_commands_id: registerGame.id,
                    }
                });

                // Поиск всех завершённых игр команды
                let gamesFinisheds = await GameFinished.findAll({
                    where: {
                        game_id: {
                            [Sequelize.Op.in]: games.map((item) => item.id)
                        }
                    }
                });

                let countQuests = (await GamesQuests.findAll({
                    where: {
                        info_games_id: currentGames.info_games_id
                    }
                })).length;

                if (gamesFinisheds.length === countQuests) {
                    // Обработка обстоятельства, в котором игра находится
                    // на этапе судейской проверки
                    socket.emit("status_on", JSON.stringify({
                        player: false,
                        judge: false,
                        player_status: 0
                    }));

                    return;
                } else {
                    // Перезаписываем список игр, которые ещё не были пройдены
                    games = await Games.findAll({
                        where: {
                            id: {
                                [Sequelize.Op.and]: [
                                    { [Sequelize.Op.notIn]: gamesFinisheds.map((item) => item.game_id) },
                                    { [Sequelize.Op.in]: games.map((item) => item.id) }
                                ]
                            }
                        }
                    });

                    if (games.length === 0) {
                        // Если игра ещё не была поставлена на очередь, то отправляем
                        // игроку пустой статус (без ухода из групповой комнаты)
                        socket.emit("status_on", JSON.stringify({
                            player: false,
                            judge: false,
                            player_status: 0
                        }));

                        // Отправив повторный статус пользователь узнает прошёл ли он игру или находится игра
                        // на этапе судейской оценки
                        return;
                    } else {
                        // Теперь известно, что games[0] - текущая игра за которой закреплена команда
                        const currentGameQuest = games[0];
                        const currentGameQuestInfo = await Quests.findOne({
                            where: {
                                id: currentGameQuest.quests_id
                            },
                            include: {
                                model: Marks
                            }
                        });

                        if (!(socket.rooms.has(currentGames.commands_id))) {
                            // Подключение на прослушивание игровых сообщений внутри команды
                            socket.join(currentGames.commands_id); // Добавление игрока в комнату команды (название команды уникально)
                        }

                        // Отправка игроку информации, о текущем задании
                        socket.emit("status_on", JSON.stringify({
                            player: true,
                            judge: false,
                            player_status: playerStatus
                        }),
                            JSON.stringify({
                                task: currentGameQuestInfo.task,
                                hint: currentGameQuestInfo.hint,
                                number: ((await Games.findAll({
                                    where: {
                                        id: {
                                            [Sequelize.Op.in]: gamesFinisheds.map((item) => item.game_id)
                                        }
                                    }
                                })).length + 1),
                                ...currentGameQuest.dataValues,
                                current_games_id: currentGames.id
                            })
                        );

                        if (currentGameQuest.view) {
                            socket.emit("set_view_current_quest", JSON.stringify({
                                radius: currentGameQuestInfo.radius,
                                lat: currentGameQuestInfo.dataValues.mark.dataValues.lat,
                                lng: currentGameQuestInfo.dataValues.mark.dataValues.lng
                            }));

                            socket.emit("load_media_instructions"); // Отправка сообщения всем игрокам команды о том, 
                            // что необходимо загрузить медиафайл с инструкцией
                        } else {
                            socket.emit("clear_games_marks");
                            socket.emit("not_load_media_instructions");
                        }
                    }
                }
            }
        } catch (e) {
            console.log(e);
            logger.error({
                file: 'server.js',
                function: 'Socket on status',
                message: e.message,
            });
        }
    });

    socket.on("command_status", async () => {
        try {
            // Поиск пользователя из списка подключенных
            let index = duExistsValueIndex(dataUsers, socket.id);
            if (index < 0) {
                return;
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            if (!dataPlayers) {
                return;
            }

            if (!dataPlayers.commands_id) {
                socket.emit("command_status_on", JSON.stringify({
                    status: 0,
                    commands_id: dataPlayers.commands_id
                }));
                return;
            }

            const isCreator = await Commands.findOne({
                where: {
                    users_id: dataPlayers.users_id,
                    id: dataPlayers.commands_id
                }
            });

            if (!isCreator) {
                socket.emit("command_status_on", JSON.stringify({
                    status: 1,
                    commands_id: dataPlayers.commands_id
                }));
            } else {
                socket.emit("command_status_on", JSON.stringify({
                    status: 2,
                    commands_id: dataPlayers.commands_id
                }));
            }
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on command_status',
                message: e.message,
            });
        }
    });

    // Получение отдельным членом команды всех координат других пользователей
    socket.on("set_player_coordinates", async (data) => {
        try {
            let index = duExistsValueIndex(dataUsers, socket.id);
            if (index < 0) {
                return;
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            if ((!dataPlayers) || (!dataPlayers.commands_id)) {
                return;
            }

            socket.to(dataPlayers.commands_id).emit("add_player_coordinates", data);
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on set_player_coordinates',
                message: e.message,
            });
        }
    });

    // Запрос пользователем всех текущих координат пользователей, которые находятся
    // вместе с ним в команде и в данный момент в сети
    socket.on("coordinates_players", async () => {
        try {
            // Отправка всем членам команды события для получения их текущих координат
            let index = duExistsValueIndex(dataUsers, socket.id);
            if (index < 0) {
                return;
            }

            const dataPlayers = await DataPlayers.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            if ((!dataPlayers) || (!dataPlayers.commands_id)) {
                return;
            }

            socket.to(dataPlayers.commands_id).emit('get_player_coordinates');
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on coordinates_players',
                message: e.message,
            });
        }
    });

    // Запись текущих координат игрока в базу данных
    socket.on("set_current_coordinates", async (data) => {
        try {
            const currentLocation = JSON.parse(data);
            if (!currentLocation.users_id) {
                return;
            }

            const coordPlayers = await CoordPlayers.findOne({
                where: {
                    users_id: currentLocation.users_id
                }
            });

            if (!coordPlayers) {
                return;
            }

            await coordPlayers.update({
                lat: currentLocation.lat,
                lng: currentLocation.lng
            });
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on set_current_coordinates',
                message: e.message,
            });
        }
    });

    // Получение координат пользователя из базы данных
    socket.on("get_my_coordinates", async () => {
        try {
            const index = duExistsValueIndex(dataUsers, socket.id);
            if (index < 0)
                return;

            const dataCoords = await CoordPlayers.findOne({
                where: {
                    users_id: dataUsers[index].users_id
                }
            });

            if (!dataCoords) {
                return;
            }

            // Отправка координат из БД на устройство
            socket.emit("set_my_coordinates", JSON.stringify({
                lat: dataCoords.lat,
                lng: dataCoords.lng,
            }));
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on get_my_coordinates',
                message: e.message,
            });
        }
    });

    socket.on('disconnect', async () => {
        try {
            const index = duExistsValueIndex(dataUsers, socket.id);
            if (index >= 0) {
                const value = await DataPlayers.findOne({
                    where: {
                        users_id: dataUsers[index].users_id
                    }
                });

                if ((value) && (value.commands_id)) {
                    socket.to(value.commands_id).emit('team_player_disconnect', JSON.stringify({
                        users_id: value.users_id
                    }));
                }
                dataUsers.splice(index, 1); // Удаление пользователя из глобального объекта
            }
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Socket on disconnect',
                message: e.message,
            });
        }
    });
});

// Обработка выбора судей для судейства существующих текущих игр
(async () => {
    while (gameProcess) {
        try {
            const games = await CurrentGames.findAll();

            // Фильтруем список игр таким образом, что остаются 
            // только те текущие игры, которые остались без судьи
            await games.removeIfAsync(async (item) => {
                const fixJudges = await FixJudges.findOne({
                    where: {
                        commands_id: item.commands_id,
                        info_games_id: item.info_games_id
                    }
                });

                return (fixJudges) ? true : false;
            });

            // Формирование списка идентификаторов всех команд, которые в
            // данный момент имеют текущую игру
            const allCommandsId = games.map((item) => {
                return item.commands_id
            });

            for (let i = 0; i < games.length; i++) {
                // Алгоритм закрепления судьи за определённой командой
                // Описание:
                // Проихсодит получение всех игроков, которые не принадлежат командам,
                // которые имеют в настоящий момент текущую игру (чтобы не отвлекать других игроков от судейской роли),
                // в случае, если таких игроков нет, то происходит рандомный выбор игрока судьи из всех имеющихся игроков

                // Выбор всех игроков, которые не принадлежат ни одной команде
                let players = await DataPlayers.findAll({
                    where: {
                        commands_id: {
                            [Sequelize.Op.notIn]: allCommandsId
                        }
                    }
                });

                // Если таких игроков нет, то выбираем судью из всех имеющихся игроков (рандомным образом)
                if (players.length == 0) {
                    players = await DataPlayers.findAll();
                }

                // Отсеивание игроков, которые уже являются судьями для текущих игр
                await players.removeIfAsync(async (item) => {
                    // Считывание судейской статистики данного игрока
                    const fixJudges = await FixJudges.findAll({
                        where: {
                            users_id: item.users_id
                        }
                    });

                    // Фильтрация судейской статистики данного игрока
                    await fixJudges.removeIfAsync(async (item) => {
                        const isCompleted = await CompleteGames.findOne({
                            where: {
                                info_games_id: item.info_games_id,
                                commands_id: item.commands_id
                            }
                        });

                        const isGameEnding = await InfoGames.findOne({
                            where: {
                                id: item.info_games_id,
                                date_end: {
                                    [Sequelize.Op.lt]: (new Date())
                                }
                            }
                        });

                        return (isCompleted || isGameEnding);
                    });

                    return (fixJudges.length > 0) ? true : false;
                });

                if (players.length > 0) {
                    // Выбор рандомного игрока
                    const index = getRandomInt(0, (players.length - 1));

                    // Добавление выбранного игрока за текущей игрой в качестве судьи
                    await FixJudges.create({
                        users_id: players[index].users_id,
                        commands_id: games[i].commands_id,
                        info_games_id: games[i].info_games_id
                    });
                }
            }
        } catch (e) {
            logger.error({
                file: 'server.js',
                function: 'Queue current games',
                message: e.message,
            });
        }

        await sleep(1000);
    }
})();

// Автоматизация установки текущих игр для команд, которые были на них зарегистрированы
(async () => {
    while (gameProcess) {
        try {
            // Выбор всех команд, у которых имеются текущие игры
            const teamsHaveGames = await CurrentGames.findAll();

            // Выбор всех команд, у которых текущих игр не имеется
            const commands = await Commands.findAll({
                where: {
                    id: {
                        [Sequelize.Op.notIn]: teamsHaveGames.map((item) => item.commands_id)
                    }
                }
            });

            if (commands.length > 0) {
                // Выбор всех записей в таблице регистрации, которые определяют регистрацию команды на игру
                const registers = await RegisterCommands.findAll({
                    where: {
                        commands_id: {
                            [Sequelize.Op.in]: commands.map((item) => item.id)
                        }
                    }
                });

                // Фильтрация данных в таблице регистрации: нужны только те записи регистрации для
                // команд, которые не были пройдены командами, а также записи, где игры,
                // на которые были зарегистрированы команды ещё не закончились
                await registers.removeIfAsync(async (item) => {
                    const value1 = await CompleteGames.findOne({
                        where: {
                            commands_id: item.commands_id,
                            info_games_id: item.info_games_id
                        }
                    });

                    // Поиск игры, которая уже началась по данной записи в таблице регистрации
                    const value2 = await InfoGames.findOne({
                        where: {
                            id: item.info_games_id,
                            // Дата начала игры меньше текущей даты (или равна ей)
                            date_begin: {
                                [Sequelize.Op.lte]: (new Date())
                            },
                            // И дата завершения игры больше текущей даты
                            date_end: {
                                [Sequelize.Op.gt]: (new Date())
                            }
                        }
                    });

                    // Если игра завершена или нет такой игры, которая началась, но ещё не завершалась,
                    // то удаляем данную запись из таблицы регистрации
                    return ((value1) || (!value2));
                });

                // Перебираем все записи, по которым необходимо добавить новую текущую игру
                // для каждой команды, которая на такую игру зарегистрировалась
                for (let i = 0; i < registers.length; i++) {
                    await CurrentGames.create({
                        commands_id: registers[i].commands_id,
                        info_games_id: registers[i].info_games_id
                    });
                }
            }
        } catch (e) {
            console.log(e);
            logger.error({
                file: 'server.js',
                function: 'Queue current games',
                message: e.message,
            });
        }

        await sleep(1000);
    }
})();

// Данная функция просматривает текущие игры и определяет
// на каком этапе находятся игроки, которые её проходят
(async () => {
    while (gameProcess) {
        try {
            // Получение списка команд, которые зарегистрированы на игру
            // register_commands сохраняет в себе все регистрации команд на определённую игру
            // а current_games только на определённую 1-у игру, которая впоследствии перезаписывается
            // т.к. текущая игра у команды может быть только одна
            const commands = await CurrentGames.findAll();

            // Обработка завершения игр и отсеивание их из всех обнаруженных 
            // текущих игр, а также их завершения в базе данных
            await commands.removeIfAsync(async (item) => {
                const isCompleted = await CompleteGames.findOne({
                    where: {
                        info_games_id: item.info_games_id,
                        commands_id: item.commands_id
                    }
                });

                // Поиск игры, которая уже закончилась, но была текущей для данной команды
                /*const isGameEnding = await InfoGames.findOne({
                    where: {
                        id: item.info_games_id,
                        date_end: {
                            [Sequelize.Op.lt]: (new Date())
                        }
                    }
                });

                const result = (isCompleted || isGameEnding);*/

                // Если данная текущая игра пройдена данной командой или была завершена,
                // то удалить данную игру из БД и из рассматриваемого множества текущих игр
                if (isCompleted) {
                    // Удаление зафиксированного судьи ...
                    // [функционал удаления на данный момент является условным,
                    // такое решение было принято для того, чтобы не вмешиваться в уже имеющуюся
                    // структуры БД на момент MVP для меньших трудозатрат. Это не мешает игровому процессу]

                    // Удаление текущей игры
                    await CurrentGames.destroy({
                        where: {
                            info_games_id: item.info_games_id,
                            commands_id: item.commands_id
                        }
                    });
                }

                return (isCompleted) ? true : false;
            });

            for (let i = 0; i < commands.length; i++) {
                // Поиск регистрационной записи, для текущей игры рассматриваемой команды
                const registerGame = await RegisterCommands.findOne({
                    where: {
                        info_games_id: commands[i].info_games_id,
                        commands_id: commands[i].commands_id
                    }
                });

                // Поиск всех игр команды по текущей игре
                const games = await Games.findAll({
                    where: {
                        register_commands_id: registerGame.id,
                    }
                });

                // Все квесты данной игры
                const gameQuests = await GamesQuests.findAll({
                    where: {
                        info_games_id: commands[i].info_games_id
                    }
                });

                // Определение всех заданий для текущей игры и текущей команды, которые были пройдены
                const finisheds = await GameFinished.findAll({
                    where: {
                        game_id: {
                            [Sequelize.Op.in]: games.map((item) => item.id)
                        }
                    }
                });

                const gamesFinished = [];

                // Отсеивание тех игр для текущей игры, которые были пройдены
                await games.removeIfAsync(async (item) => {
                    let flag = false;
                    for (let i = 0; i < finisheds.length; i++) {
                        if (finisheds[i].game_id == item.id) {
                            flag = true;
                            gamesFinished.push(item);
                            break;
                        }
                    }

                    return flag;
                });

                // Формирование квестов, которые не были пройдены данной командой
                gameQuests.removeIf((item) => {
                    for (let i = 0; i < gamesFinished.length; i++) {
                        if (gamesFinished[i].quests_id == item.quests_id) {
                            return true;
                        }
                    }

                    return false;
                });

                const infoGames = await InfoGames.findOne({
                    where: {
                        id: commands[i].info_games_id
                    }
                });

                // Проверка даты текущей игры, если дата завершения 
                // игры меньше либо равна текущей дате, то игра считается пройденной
                // и игра завершается
                if ((new Date(infoGames.date_end)) <= (new Date())) {
                    const completeGames = await CompleteGames.findOne({
                        where: {
                            info_games_id: commands[i].info_games_id
                        }
                    });

                    const currentGames = await CurrentGames.findOne({
                        where: {
                            info_games_id: commands[i].info_games_id,
                            commands_id: commands[i].commands_id
                        }
                    });

                    // Отправка сообщения о завершении игры
                    // всем игрокам, которые находятся в сети
                    // для данной команды
                    io.to(commands[i].commands_id).emit("game_over");

                    if (!completeGames) {
                        let score = 0;
                        for (let i = 0; i < finisheds.length; i++) {
                            const judgeScore = await JudgeScore.findOne({
                                where: {
                                    game_finished_id: finisheds[i].id
                                }
                            });

                            if (judgeScore) {
                                score += judgeScore.score;
                            }
                        }

                        await CompleteGames.create({
                            commands_id: commands[i].commands_id,
                            info_games_id: commands[i].info_games_id,
                            completed: false,
                            current_score: score,
                        });

                        // Удаление судъи из списка (не удаляется, т.к. необходимо сохранять ссылку на судью)
                        // ########################### [comment='judge-begin']
                        /*const fixJudges = await FixJudges.findOne({
                            commands_id: currentGames.commands_id,
                            info_games_id: currentGames.info_games_id
                        });

                        await fixJudges.destroy();*/
                        // ########################### [comment-end='judge-begin']

                        // Удаление текущей игры
                        await currentGames.destroy();
                    } else {
                        // Обновляем статус игры на не пройденную
                        if (!completeGames.completed) {
                            await completeGames.update({
                                completed: false
                            });
                        }

                        // ########################### [comment='judge-begin']
                        /*const fixJudges = await FixJudges.findOne({
                            commands_id: currentGames.commands_id,
                            info_games_id: currentGames.info_games_id
                        });

                        await fixJudges.destroy();*/
                        // ########################### [comment-end='judge-begin']
                        await currentGames.destroy();
                    }
                }

                if (games.length === 0) {
                    // Если нет текущей игры, то инициируется попытка её создания
                    if (gameQuests.length === 0) {
                        // Если все квесты были пройдены, то необходимо узнать оценил ли судъя каждый
                        // квест по отдельности, если оценил - то игра считается полностью пройденной, если 
                        // ещё не дал оценку хотя бы 1 квесту, то игра на этапе оценки. Когда игра на этапе оценки
                        // команда не может быть зарегистрирована на игру - вся команда ожидает результатов
                        const judgeScores = [];
                        for (let i = 0; i < finisheds.length; i++) {
                            const value = await JudgeScore.findOne({
                                where: {
                                    game_finished_id: finisheds[i].id
                                }
                            });

                            if (value) {
                                judgeScores.push(value);
                            }
                        }

                        const currentGames = await CurrentGames.findOne({
                            where: {
                                info_games_id: commands[i].info_games_id,
                                commands_id: commands[i].commands_id
                            }
                        });

                        const countQuests = await GamesQuests.findAll({
                            where: {
                                info_games_id: commands[i].info_games_id
                            }
                        });

                        if ((judgeScores.length === finisheds.length)
                            && (finisheds.length === countQuests.length)) {
                            // Если количество записей в таблице оценок равно количеству
                            // записей в таблице завершённых меток, то игра считается пройденной полностью
                            // (также необходимо чтобы оба значения были равны общему числу квестов в текущей игре)
                            // и оцененной судъей полностью
                            const completeGames = await CompleteGames.findOne({
                                where: {
                                    info_games_id: commands[i].info_games_id
                                }
                            });

                            io.to(commands[i].commands_id).emit("game_over");
                            if (!completeGames) {
                                let score = 0;
                                for (let i = 0; i < finisheds.length; i++) {
                                    const judgeScore = await JudgeScore.findOne({
                                        where: {
                                            game_finished_id: finisheds[i].id
                                        }
                                    });

                                    if (judgeScore) {
                                        score += judgeScore.score;
                                    }
                                }

                                await CompleteGames.create({
                                    commands_id: commands[i].commands_id,
                                    info_games_id: commands[i].info_games_id,
                                    completed: true,
                                    current_score: score,
                                });

                                // ########################### [comment='judge-begin']
                                /*const fixJudges = await FixJudges.findOne({
                                    commands_id: currentGames.commands_id,
                                    info_games_id: currentGames.info_games_id
                                });
        
                                await fixJudges.destroy();*/
                                // ########################### [comment-end='judge-begin']

                                await currentGames.destroy();
                            } else {
                                // Обновляем статус игры на пройденную
                                if (!completeGames.completed) {
                                    await completeGames.update({
                                        completed: true
                                    });
                                }

                                // ########################### [comment='judge-begin']
                                /*const fixJudges = await FixJudges.findOne({
                                    commands_id: currentGames.commands_id,
                                    info_games_id: currentGames.info_games_id
                                });
       
                                await fixJudges.destroy();*/
                                // ########################### [comment-end='judge-begin']

                                await currentGames.destroy();
                            }
                        }
                    } else {
                        // Свободные квесты есть, а значит - их можно выдать команде для их прохождения
                        const newQuest = await Quests.findOne({
                            where: {
                                id: gameQuests[0].quests_id
                            }
                        });

                        // Добавление новой игры для команды
                        await Games.create({
                            view: false,
                            commands_id: commands[i].commands_id,
                            register_commands_id: registerGame.id,
                            quests_id: newQuest.id
                        });
                    }
                } else {
                    // Текущая игра есть, необходимо определить её видимость для игроков.
                    // В случае, когда текущая игра, за которой они закреплены, видима,
                    // игроки получают об этом уведомление. И когда они все собираются у точки
                    // происходит выбор из команды одного человека, который будет оператором,
                    // и на все устройства происходит загрузка видео, которое подразумевает собой выполнение
                    // какого-либо действия

                    // Получение информации о текущем задании
                    const currentGame = await Games.findOne({
                        where: {
                            id: games[0].id
                        }
                    });

                    // Для дальнейшего шага необходимо выполнение условия "имеется текущее задание и оно ещё не видимо"
                    if ((currentGame) && (!currentGame.view)) {
                        // Определение текущего квеста по заданию
                        const currentQuest = await Quests.findOne({
                            where: {
                                id: currentGame.quests_id
                            },
                            include: {
                                model: Marks
                            }
                        });

                        // Определение игроков в текущей команде
                        const dataPlayers = await DataPlayers.findAll({
                            where: {
                                commands_id: commands[i].commands_id
                            }
                        });

                        // Фильтрация игроков: остаются лишь те, которые были
                        // подключены к сети, и которые не являются судьями для других игр
                        await dataPlayers.removeIfAsync(async (item) => {
                            const isJudge = await FixJudges.findOne({
                                where: {
                                    users_id: item.users_id,
                                    info_games_id: commands[i].info_games_id
                                }
                            });

                            return ((isJudge) || (duGetIndexById(dataUsers, item.users_id) < 0));
                        });

                        for (let i = 0; i < dataPlayers.length; i++) {
                            const value = await CoordPlayers.findOne({
                                where: {
                                    users_id: dataPlayers[i].users_id
                                }
                            });

                            // Проверяем координаты игрока только в том случае, когда он в сети и его координаты есть в БД
                            if (value) {
                                if (mathCircle.intersectionCircles(
                                    value.lat,
                                    value.lng,
                                    currentQuest.dataValues.mark.dataValues.lat,
                                    currentQuest.dataValues.mark.dataValues.lng,
                                    mathCircle.radiusLatLng(100),
                                    mathCircle.radiusLatLng(currentQuest.radius)
                                )) {
                                    // Если окружность игрока пересекла окружность квеста, то сделать текущий квест видимым
                                    // тем самым запустив процесс загрузки видео с медиасервера на устройство каждого пользователя
                                    // для получения задания и процесс определения того, кто будет являться оператором
                                    // от которого зависит перейдёт ли команда к следующему квесту или нет
                                    await currentGame.update({
                                        view: true
                                    });

                                    // После того, как метка была найдена из всех игроков в команде выбирается тот,
                                    // кто будет вести съёмку видео, которое будет отправлено на сервер в качестве
                                    // результата действий игроков (ответ на медиафайл квеста)

                                    const playerIndex = getRandomInt(0, (dataPlayers.length - 1));

                                    // Определение того, имеется ли в текущий момент видеооператор для данного задания
                                    const findVideoShooter = await VideoShooters.findOne({
                                        where: {
                                            games_id: currentGame.id
                                        }
                                    });

                                    if (!findVideoShooter) {
                                        // Если видеооператора для данного задания нет,
                                        // то добавляем его в базу данных
                                        await VideoShooters.create({
                                            games_id: currentGame.id,
                                            data_players_id: dataPlayers[playerIndex].id
                                        });
                                    }

                                    // Выходим из цикла, т.к. теперь текущее задание видно и можно
                                    // не сравнивать координаты всех меток с координатами игроков
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log(e);
            logger.error({
                file: 'server.js',
                function: 'Main async function game process',
                message: e.message,
            });
        }

        await sleep(1000);
    }
})();
