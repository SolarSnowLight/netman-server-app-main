module.exports = function (sequelize, DataTypes) {
    return sequelize.define('quests', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        task: {
            type: DataTypes.STRING(1024),
            allowNull: false
        },
        hint: {
            type: DataTypes.STRING(512),
            allowNull: false
        },
        ref_media: {
            type: DataTypes.STRING,
            allowNull: false
        },
        radius: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
    });
};