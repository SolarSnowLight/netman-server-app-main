module.exports = function (sequelize, DataTypes) {
    return sequelize.define('games_quests', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        }
    });
};