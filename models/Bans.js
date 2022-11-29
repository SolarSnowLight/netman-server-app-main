module.exports = function (sequelize, DataTypes) {
    return sequelize.define('bans', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        reason: {
            type: DataTypes.STRING(1024),
            allowNull: false
        }
    });
};