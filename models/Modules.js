module.exports = function (sequelize, DataTypes) {
    return sequelize.define('users_modules', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        player: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        judge: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        creator: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        moderator: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        manager: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        admin: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        super_admin: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
    });
};