module.exports = function (sequelize, DataTypes) {
    return sequelize.define('queue_games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
};