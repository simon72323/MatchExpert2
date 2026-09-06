/** 遊戲音效／BGM key（對齊 S5G：enum member = 字串值） */
export enum AudioKey {
    btnClick = 'btnClick',
    btnClose = 'btnClose',
    hitError = 'hitError',
    boxTouch = 'boxTouch',
    fireHit = 'fireHit',
    stoneHit = 'stoneHit',
    iceHit = 'iceHit',
    UI_Drag_PutIn = 'UI_Drag_PutIn',
    hideOpen = 'hideOpen',
    matchAllTile = 'matchAllTile',
    /** 三消爆破（Unity boxBomb） */
    boxBomb = 'boxBomb',
    tip = 'tip',
    win = 'win',
    lose = 'lose',

    /** 進關 BGM */
    bgm_game = 'bgm_game',
    /** 地圖 BGM */
    bgm_map = 'bgm_map',
}
