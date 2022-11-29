/*
* Модель для таблицы токенов
*/

// Спецификация по type_auth:
// 0 - обычная авторизация (без дополнительных сервисов)
// 1 - авторизация через OAuth2

module.exports = function (sequelize, DataTypes) {
    return sequelize.define('tokens', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        access_token: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        refresh_token: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });
};