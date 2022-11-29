module.exports = function (sequelize, DataTypes) {
    return sequelize.define('groups_attributes', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        read: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        write: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        update: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        delete: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
    });
};