//********************************************************
// Проверка доступа к определённому модулю
//********************************************************

const {                                     // Подключение моделей для взаимодействия с базой данных
    UserModules,  GroupModules,
    UserGroups, UserRoles, 
} = require('../sequelize/models');

const checkAccessModule = async (usersId, module) => {
    const modules = await UserModules.findOne({ where: { users_id: usersId } });
    if (!modules)
        return false;
    let access = false || modules[module];

    const userRoles = await UserRoles.findOne({
        where: {
            users_id: usersId
        }
    });

    if (!userRoles.user_groups_name) {
        return access;
    }

    const userGroups = await UserGroups.findOne({
        where: {
            name: userRoles.user_groups_name
        }
    });

    if (!userGroups) {
        return access;
    }

    const groupModules = await GroupModules.findOne({
        where: {
            user_groups_name: userGroups.name
        }
    });

    access = access || groupModules[module];

    return access;
};

module.exports.checkAccessModule = checkAccessModule;