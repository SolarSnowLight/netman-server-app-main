module.exports = function (sequelize, DataTypes) {
    return sequelize.define('activations', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        is_activated: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        activation_link: {
            type: DataTypes.STRING(512),
            allowNull: false,
        }
    });
};