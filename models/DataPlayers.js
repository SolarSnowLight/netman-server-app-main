module.exports = function (sequelize, DataTypes) {
    return sequelize.define('data_players', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    });
};