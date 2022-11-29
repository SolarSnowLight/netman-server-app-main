//-------------------------------------------------------
//Константы маршрутов для серверной части приложения
//-------------------------------------------------------

const address_config = {
    sequrity_access: '/sequrity/access',    // Полный адрес
    s_access: '/access',                    // Укороченный адрес

    sequrity_token: '/sequrity/token',
    s_token: '/token',

    sequrity_exists: '/sequrity/exists',
    s_exists: '/exists',

    // Регистрация нового пользователя
    auth_register: '/auth/register',
    a_register: '/register',

    // Подтверждение аккаунта
    auth_activate: '/auth/activate/:link',
    a_activate: '/activate/:link',

    // Обновление токена
    auth_refresh_token: '/auth/refresh/token',
    a_refresh_token: '/refresh/token',

    // Общая авторизация пользователя
    auth_login: '/auth/login',
    a_login: '/login',

    auth_oauth: '/auth/oauth',
    a_oauth: '/oauth',

    // Авторизация пользователей наделённые большими полномочиями,
    // чем игрок и судъя
    auth_management_login: '/auth/management/login',
    a_management_login: '/management/login',

    auth_management_oauth: '/auth/management/oauth',
    a_management_oauth: '/management/oauth',

    auth_management_logout: '/auth/management/logout',
    a_management_logout: '/management/logout',

    map_marks_free: '/map/marks/free',
    m_marks_free: '/marks/free',

    map_geocoder_address: '/map/geocoder/address',
    m_geocoder_address: '/geocoder/address',

    map_marks_add: '/map/marks/add',
    m_marks_add: '/marks/add',

    map_marks: '/map/marks',
    m_marks: '/marks',

    //*****Функции создателя*****
    function_creator_games_add: '/function/creator/games/add',
    f_creator_games_add: '/games/add',

    function_creator_games_created: '/function/creator/games/created',
    f_creator_games_created: '/games/created',

    function_creator_games_delete: '/function/creator/games/delete',
    f_creator_games_delete: '/games/delete',

    //*****Функции модератора*****
    function_moderator_games_queue: '/function/moderator/games/queue',
    f_moderator_games_queue: '/games/queue',

    function_moderator_creator_info: '/function/moderator/creator/info',
    f_moderator_creator_info: '/creator/info',

    function_moderator_creators_list: '/function/moderator/creators/list',
    f_moderator_creators_list: '/creators/list',

    function_moderator_game_info: '/function/moderator/game/info',
    f_moderator_game_info: '/game/info',

    function_moderator_game_accepted: '/function/moderator/game/accepted',
    f_moderator_game_accepted: '/game/accepted',

    function_moderator_games_checked: "/function/moderator/games/checked",
    f_moderator_games_checked: "/games/checked",

    function_moderator_game_warning: '/function/moderator/game/warning',
    f_moderator_game_warning: '/game/warning',

    function_moderator_game_ban: '/function/moderator/game/ban',
    f_moderator_game_ban: '/game/ban',

    function_moderator_game_unban: '/function/moderator/game/unban',
    f_moderator_game_unban: '/game/unban',

    //*****Функции игрока*****
    function_player_games: '/function/player/games',
    f_player_games: '/games',

    function_player_info: '/function/player/info',
    f_player_info: '/info',

    function_player_info_update: '/function/player/info/update',
    f_player_info_update: '/info/update',

    function_player_statistics: '/function/player/statistics',
    f_player_statistics: '/statistics',

    function_player_command: '/function/player/command',
    f_player_command: '/command',

    function_player_command_players: '/function/player/command/players',
    f_player_command_players: '/command/players',

    function_player_command_current_game: '/function/player/command/current/game',
    f_player_command_current_game: '/command/current/game',

    function_player_command_games: '/function/player/command/games',
    f_player_command_games: '/command/games',

    function_player_game_status: '/function/player/game/status',
    f_player_game_status: '/game/status',

    function_player_commands_list: '/function/player/commands/list',
    f_player_commands_list: '/commands/list',

    function_player_command_join: '/function/player/command/join',
    f_player_command_join: '/command/join',

    function_player_command_detach: '/function/player/command/detach',
    f_player_command_detach: '/command/detach',

    function_player_command_create: '/function/player/command/create',
    f_player_command_create: '/command/create',

    function_player_command_register_game: '/function/player/command/register/game',
    f_player_command_register_game: '/command/register/game',

    function_player_command_available_games: '/function/player/command/available/games',
    f_player_command_available_games: '/command/available/games',

    function_player_command_free_list_tag: '/function/player/command/free/list/tag',
    f_player_command_free_list_tag: '/command/free/list/tag',

    function_player_command_join_certain: '/function/player/command/join/certain',
    f_player_command_join_certain: '/command/join/certain',

    function_player_find_certain: '/function/player/find/certain',
    f_player_find_certain: '/find/certain',

    function_player_command_current_media_instructions: '/function/player/command/current/media/instructions',
    f_player_command_current_media_instructions: '/command/current/media/instructions',

    function_player_command_add_result: '/function/player/command/add/result',
    f_player_command_add_result: '/command/add/result',

    function_player_judge_get_info: '/function/player/judge/get/info',
    f_player_judge_get_info: '/judge/get/info',

    function_player_judge_set_score: '/function/player/judge/set/score',
    f_player_judge_set_score: '/judge/set/score',

    google_sequrity_oauth: 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=', // Проверка токена в Google сервисах
    google_user_data: 'https://www.googleapis.com/oauth2/v2/userinfo?access_token=',       // Получение пользовательской информации

    google_sequrity_oauth_refresh_token: 'https://www.googleapis.com/oauth2/v1/tokeninfo?refresh_token=',
    google_user_data_refresh_token: 'https://www.googleapis.com/oauth2/v2/userinfo?refresh_token=', 

    //*************************************************
    media_upload_users_file: "/media/upload/users/file",
    m_upload_users_file: "/upload/users/file",
    media_donwload_users_file: "/media/download/users/file",
    m_download_users_file: "/download/users/file"
};

module.exports.address_config = address_config;