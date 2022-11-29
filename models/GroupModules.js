module.exports = function (sequelize, DataTypes) {
    return sequelize.define('groups_modules', {
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