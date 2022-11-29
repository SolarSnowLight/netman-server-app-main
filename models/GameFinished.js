module.exports = function (sequelize, DataTypes) {
    return sequelize.define('game_finisheds', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        ref_image: {
            type: DataTypes.STRING(512),
            allowNull: false
        }
    });
};