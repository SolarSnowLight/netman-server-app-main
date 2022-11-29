module.exports = function (sequelize, DataTypes) {
    return sequelize.define('video_shooters', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        }
    });
};