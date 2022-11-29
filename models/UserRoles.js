module.exports = function (sequelize, DataTypes) {
    return sequelize.define('users_roles', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        name_role: {
            type: DataTypes.STRING,
            allowNull: false
        },
    });
};