module.exports = function (sequelize, DataTypes) {
    return sequelize.define('current_games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        }
    });
};