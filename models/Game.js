module.exports = function (sequelize, DataTypes) {
    return sequelize.define('games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        view: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    });
};