module.exports = function (sequelize, DataTypes) {
    return sequelize.define('users_groups', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        date_create: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
};