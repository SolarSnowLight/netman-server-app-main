module.exports = function (sequelize, DataTypes) {
    return sequelize.define('info_games', {
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
        max_count_commands: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        date_begin: {
            type: DataTypes.DATE,
            allowNull: false
        },
        date_end: {
            type: DataTypes.DATE,
            allowNull: false
        },
        age_limit: {
            type: DataTypes.SMALLINT,
            allowNull: false
        },
        type: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        rating: {
            type: DataTypes.SMALLINT,
            allowNull: false
        },
        min_score: {
            type: DataTypes.SMALLINT,
            allowNull: false
        },
        location: {
            type: DataTypes.STRING,
            allowNull: false
        },
    });
};