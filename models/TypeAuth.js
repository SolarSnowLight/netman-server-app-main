/*
* Модель для таблицы типов авторизации каждого пользователя
*/

// Спецификация по type:
// 0 - обычная авторизация (без дополнительных сервисов)
// 1 - авторизация через OAuth2

module.exports = function (sequelize, DataTypes) {
    return sequelize.define('auth_types', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        type: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    });
};