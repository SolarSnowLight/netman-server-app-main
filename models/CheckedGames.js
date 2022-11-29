module.exports = function (sequelize, DataTypes) {
    return sequelize.define('checked_games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    });
};