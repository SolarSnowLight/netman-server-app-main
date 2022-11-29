const config = require("config");           //подключение конфига
const Sequelize = require("sequelize");
const sequelize = new Sequelize(            //установка подключения с базой данных
    config.get("database").database,
    config.get("database").user,
    config.get("database").password,
    {
        dialect: "postgres",
        host: config.get("database").host,
        port: config.get("database").port,
        define: {
            timestamps: false
        },
        logging: false
    },
);

//-----------------------------------------------------------------------------------------
//взаимодействие с моделями базы данных
const User              = require('../models/Users')(sequelize, Sequelize);
const PersonalData      = require('../models/Personals')(sequelize, Sequelize);
const UserAttributes    = require('../models/Attributes')(sequelize, Sequelize);
const UserModules       = require('../models/Modules')(sequelize, Sequelize);
const GroupAttributes   = require('../models/GroupAttributes')(sequelize, Sequelize);
const GroupModules      = require('../models/GroupModules')(sequelize, Sequelize);
const UserGroups        = require('../models/UserGroups')(sequelize, Sequelize);
const UserRoles         = require('../models/UserRoles')(sequelize, Sequelize);
const DataPlayers       = require('../models/DataPlayers')(sequelize, Sequelize);
const Commands          = require('../models/Commands')(sequelize, Sequelize);
const CoordPlayers      = require('../models/CoordPlayers')(sequelize, Sequelize);
const InfoGames         = require('../models/InfoGames')(sequelize, Sequelize);
const Quests            = require('../models/Quests')(sequelize, Sequelize);
const RegisterCommands  = require('../models/RegisterCommands')(sequelize, Sequelize);
const Marks             = require('../models/Marks')(sequelize, Sequelize);
const CompleteGames     = require('../models/CompleteGames')(sequelize, Sequelize);
const GamesQuests       = require('../models/GamesQuests')(sequelize, Sequelize);
const CheckedGames      = require('../models/CheckedGames')(sequelize, Sequelize);
const Bans              = require('../models/Bans')(sequelize, Sequelize);
const Warnings          = require('../models/Warnings')(sequelize, Sequelize);
const QueueGamesCheck   = require('../models/QueueGamesCheck')(sequelize, Sequelize);
const Game              = require('../models/Game')(sequelize, Sequelize);
const GameFinished      = require('../models/GameFinished')(sequelize, Sequelize);
const JudgeScore        = require('../models/JudgeScore')(sequelize, Sequelize);
const CurrentGames      = require("../models/CurrentGames")(sequelize, Sequelize);
const FixJudges         = require("../models/FixJudgesjs")(sequelize, Sequelize);
const VideoShooters     = require("../models/VideoShooters")(sequelize, Sequelize);
const Tokens            = require("../models/Tokens")(sequelize, Sequelize);
const Activations       = require("../models/Activations")(sequelize, Sequelize);
const TypeAuth          = require("../models/TypeAuth")(sequelize, Sequelize);

// Установка взаимосвязей между таблицами

// Внешний ключ users_id (ссылка на таблицу users)
const foreignKeyUsersId_NN = {
    foreignKey: {
        name: 'users_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ game_id (на таблицу games)
const foreignKeyGameId_NN = {
    foreignKey: {
        name: 'games_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

const foreignKeyGameId_NN_UNIQUE = {
    foreignKey: {
        name: 'game_id',
        unique: true,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ data_players_id (на таблицу data_players)
const foreignKeyDataPlayersId_NN = {
    foreignKey: {
        name: 'data_players_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу commands
const foreignKeyCommandsName_NN = {
    foreignKey: {
        name: 'commands_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

const foreignKeyCommandsName_YN = {
    foreignKey: {
        name: 'commands_id',
        allowNull: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу info_games
const foreignKeyInfoGamesId_NN = {
    foreignKey: {
        name: 'info_games_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу register_commands
const foreignKeyRegisterCommandsId_NN = {
    foreignKey: {
        name: 'register_commands_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу quests
const foreignKeyQuestsId_NN = {
    foreignKey: {
        name: 'quests_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу game_finisheds
const foreignKeyGameFinishedid_NN_UNIQUE = {
    foreignKey: {
        name: 'game_finished_id',
        allowNull: false,
        unique: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу fix_judges
const foreignKeyFixJudgesId_NN = {
    foreignKey: {
        name: 'fix_judges_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу users_groups
const foreignKeyUsersGroupsId_YN = {
    foreignKey: {
        name: 'users_groups_id',
        allowNull: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

const foreignKeyUsersGroupsId_NN = {
    foreignKey: {
        name: 'users_groups_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу checked_games
const foreignKeyCheckedGamesId_NN = {
    foreignKey: {
        name: 'checked_games_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
};

// Внешний ключ на таблицу marks
const foreignKeyMarksId_NN = {
    foreignKey: {
        name: 'marks_id',
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    }
}

User.hasMany(Activations, foreignKeyUsersId_NN);
Activations.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(TypeAuth, foreignKeyUsersId_NN);
TypeAuth.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(Tokens, foreignKeyUsersId_NN);
Tokens.belongsTo(User, foreignKeyUsersId_NN);

Game.hasMany(VideoShooters, foreignKeyGameId_NN);
VideoShooters.belongsTo(Game, foreignKeyGameId_NN);

DataPlayers.hasMany(VideoShooters, foreignKeyDataPlayersId_NN);
VideoShooters.belongsTo(DataPlayers, foreignKeyDataPlayersId_NN);

User.hasMany(FixJudges, foreignKeyUsersId_NN);
FixJudges.belongsTo(User, foreignKeyUsersId_NN);

Commands.hasMany(FixJudges, foreignKeyCommandsName_NN);
FixJudges.belongsTo(Commands, foreignKeyCommandsName_NN);

InfoGames.hasMany(FixJudges, foreignKeyInfoGamesId_NN);
FixJudges.belongsTo(InfoGames, foreignKeyInfoGamesId_NN)

Commands.hasMany(Game, foreignKeyCommandsName_NN);
Game.belongsTo(Commands, foreignKeyCommandsName_NN);

RegisterCommands.hasMany(Game, foreignKeyRegisterCommandsId_NN);
Game.belongsTo(RegisterCommands, foreignKeyRegisterCommandsId_NN);

Quests.hasMany(Game, foreignKeyQuestsId_NN);
Game.belongsTo(Quests, foreignKeyQuestsId_NN);

Game.hasMany(GameFinished, foreignKeyGameId_NN_UNIQUE);
GameFinished.belongsTo(Game, foreignKeyGameId_NN_UNIQUE);

GameFinished.hasMany(JudgeScore, foreignKeyGameFinishedid_NN_UNIQUE);
JudgeScore.belongsTo(GameFinished, foreignKeyGameFinishedid_NN_UNIQUE);

FixJudges.hasMany(JudgeScore, foreignKeyFixJudgesId_NN);
JudgeScore.belongsTo(FixJudges, foreignKeyFixJudgesId_NN);

User.hasMany(CheckedGames, foreignKeyUsersId_NN);
CheckedGames.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(PersonalData, foreignKeyUsersId_NN);
PersonalData.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(UserRoles, foreignKeyUsersId_NN);
UserRoles.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(UserModules, foreignKeyUsersId_NN);
UserModules.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(UserAttributes, foreignKeyUsersId_NN);
UserAttributes.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(UserGroups, foreignKeyUsersId_NN);
UserGroups.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(DataPlayers, foreignKeyUsersId_NN);
DataPlayers.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(CoordPlayers, foreignKeyUsersId_NN);
CoordPlayers.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(InfoGames, foreignKeyUsersId_NN);
InfoGames.belongsTo(User, foreignKeyUsersId_NN);

User.hasMany(Commands, foreignKeyUsersId_NN);
Commands.belongsTo(User, foreignKeyUsersId_NN);

UserGroups.hasMany(UserRoles, foreignKeyUsersGroupsId_YN);
UserRoles.belongsTo(UserGroups, foreignKeyUsersGroupsId_YN);

UserGroups.hasMany(GroupModules, foreignKeyUsersGroupsId_NN);
GroupModules.belongsTo(UserGroups, foreignKeyUsersGroupsId_NN);

UserGroups.hasMany(GroupAttributes, foreignKeyUsersGroupsId_NN);
GroupAttributes.belongsTo(UserGroups, foreignKeyUsersGroupsId_NN);

Commands.hasMany(DataPlayers, foreignKeyCommandsName_YN);
DataPlayers.belongsTo(Commands, foreignKeyCommandsName_YN);

Commands.hasMany(RegisterCommands, foreignKeyCommandsName_NN);
RegisterCommands.belongsTo(Commands, foreignKeyCommandsName_NN);

InfoGames.hasMany(RegisterCommands, foreignKeyInfoGamesId_NN);
RegisterCommands.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

Commands.hasMany(CurrentGames, foreignKeyCommandsName_NN);
CurrentGames.belongsTo(Commands, foreignKeyCommandsName_NN);

InfoGames.hasMany(CurrentGames, foreignKeyInfoGamesId_NN);
CurrentGames.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

Marks.hasMany(Quests, foreignKeyMarksId_NN);
Quests.belongsTo(Marks, foreignKeyMarksId_NN);

User.hasMany(Marks, foreignKeyUsersId_NN);
Marks.belongsTo(User, foreignKeyUsersId_NN);

Quests.hasMany(GamesQuests, foreignKeyQuestsId_NN);
GamesQuests.belongsTo(Quests, foreignKeyQuestsId_NN);

InfoGames.hasMany(GamesQuests, foreignKeyInfoGamesId_NN);
GamesQuests.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

Commands.hasMany(CompleteGames, foreignKeyCommandsName_NN);
CompleteGames.belongsTo(Commands, foreignKeyCommandsName_NN);

InfoGames.hasMany(CompleteGames, foreignKeyInfoGamesId_NN);
CompleteGames.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

InfoGames.hasMany(CheckedGames, foreignKeyInfoGamesId_NN);
CheckedGames.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

InfoGames.hasMany(QueueGamesCheck, foreignKeyInfoGamesId_NN);
QueueGamesCheck.belongsTo(InfoGames, foreignKeyInfoGamesId_NN);

CheckedGames.hasMany(Warnings, foreignKeyCheckedGamesId_NN);
Warnings.belongsTo(CheckedGames, foreignKeyCheckedGamesId_NN);

CheckedGames.hasMany(Bans, foreignKeyCheckedGamesId_NN);
Bans.belongsTo(CheckedGames, foreignKeyCheckedGamesId_NN);

//синхронизация моделей с базой данных
sequelize.sync().then(result => {
    console.log(result);
}).catch(err => console.log(err));

module.exports.VideoShooters    = VideoShooters;
module.exports.User             = User;
module.exports.PersonalData     = PersonalData;
module.exports.UserAttributes   = UserAttributes;
module.exports.UserModules      = UserModules;
module.exports.GroupAttributes  = GroupAttributes;
module.exports.GroupModules     = GroupModules;
module.exports.UserGroups       = UserGroups;
module.exports.UserRoles        = UserRoles;
module.exports.DataPlayers      = DataPlayers;
module.exports.Commands         = Commands;
module.exports.CoordPlayers     = CoordPlayers;
module.exports.InfoGames        = InfoGames;
module.exports.Quests           = Quests;
module.exports.RegisterCommands = RegisterCommands;
module.exports.Marks            = Marks;
module.exports.CompleteGames    = CompleteGames;
module.exports.GamesQuests      = GamesQuests;
module.exports.QueueGamesCheck  = QueueGamesCheck;
module.exports.Bans             = Bans;
module.exports.Warnings         = Warnings;
module.exports.CheckedGames     = CheckedGames;
module.exports.Games            = Game;
module.exports.GameFinished     = GameFinished;
module.exports.JudgeScore       = JudgeScore;
module.exports.CurrentGames     = CurrentGames;
module.exports.FixJudges        = FixJudges;
module.exports.Tokens           = Tokens;
module.exports.Activations      = Activations;
module.exports.AuthTypes        = TypeAuth;
module.exports.sequelize        = sequelize;
module.exports.Sequelize        = Sequelize;