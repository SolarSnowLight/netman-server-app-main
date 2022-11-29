module.exports = function (sequelize, DataTypes) {
    return sequelize.define('personals', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            allowNull: false,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        surname: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nickname: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        ref_image: {
            type: DataTypes.STRING,
            allowNull: false
        },
        phone_num: {
            type: DataTypes.STRING(16),
            allowNull: false,
            unique: true
        },
        date_birthday: {
            type: DataTypes.DATE,
            allowNull: false
        },
        location: {
            type: DataTypes.STRING(1024),
            allowNull: false
        },
        date_register: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });
};