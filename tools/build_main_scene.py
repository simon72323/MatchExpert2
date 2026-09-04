import json, uuid

def nid():
    # cocos-like short id
    import random, string
    chars = string.ascii_letters + string.digits + "+/"
    return "".join(random.choice(chars) for _ in range(22))

# Build scene objects list with sequential __id__ via array index
objs = []

def add(obj):
    objs.append(obj)
    return len(objs) - 1

# 0 SceneAsset
add({
    "__type__": "cc.SceneAsset",
    "_name": "Main",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_native": "",
    "scene": {"__id__": 1},
})

# 1 Scene - children filled later
scene_children = []
scene_id = add({
    "__type__": "cc.Scene",
    "_name": "Main",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_parent": None,
    "_children": scene_children,
    "_active": True,
    "_components": [],
    "_prefab": None,
    "_lpos": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
    "_lrot": {"__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1},
    "_lscale": {"__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1},
    "_mobility": 0,
    "_layer": 1073741824,
    "_euler": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
    "autoReleaseAssets": False,
    "_globals": {"__id__": None},  # fill later
    "_id": "3a6a9255-70f0-4abf-a92c-4c1629c7c3c1",
})

UI_LAYER = 33554432

def make_node(name, parent_id, children=None, components=None, active=True, layer=UI_LAYER):
    return {
        "__type__": "cc.Node",
        "_name": name,
        "_objFlags": 0,
        "__editorExtras__": {},
        "_parent": {"__id__": parent_id} if parent_id is not None else None,
        "_children": children if children is not None else [],
        "_active": active,
        "_components": components if components is not None else [],
        "_prefab": None,
        "_lpos": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
        "_lrot": {"__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1},
        "_lscale": {"__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1},
        "_mobility": 0,
        "_layer": layer,
        "_euler": {"__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0},
        "_id": nid(),
    }

def ui_transform(node_id, w=720, h=1280, ax=0.5, ay=0.5):
    return {
        "__type__": "cc.UITransform",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": node_id},
        "_enabled": True,
        "__prefab": None,
        "_contentSize": {"__type__": "cc.Size", "width": w, "height": h},
        "_anchorPoint": {"__type__": "cc.Vec2", "x": ax, "y": ay},
        "_id": nid(),
    }

def widget_full(node_id):
    return {
        "__type__": "cc.Widget",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": node_id},
        "_enabled": True,
        "__prefab": None,
        "_alignFlags": 45,
        "_target": None,
        "_left": 0,
        "_right": 0,
        "_top": 0,
        "_bottom": 0,
        "_horizontalCenter": 0,
        "_verticalCenter": 0,
        "_isAbsLeft": True,
        "_isAbsRight": True,
        "_isAbsTop": True,
        "_isAbsBottom": True,
        "_isAbsHorizontalCenter": True,
        "_isAbsVerticalCenter": True,
        "_originalWidth": 0,
        "_originalHeight": 0,
        "_alignMode": 2,
        "_lockFlags": 0,
        "_id": nid(),
    }

# ---- Canvas ----
canvas_children = []
canvas_comps = []
canvas_id = add(make_node("Canvas", 1, canvas_children, canvas_comps))
scene_children.append({"__id__": canvas_id})

# Camera under Canvas
cam_comps = []
cam_id = add(make_node("Camera", canvas_id, [], cam_comps))
canvas_children.append({"__id__": cam_id})

cam_comp_id = add({
    "__type__": "cc.Camera",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {"__id__": cam_id},
    "_enabled": True,
    "__prefab": None,
    "_projection": 0,
    "_priority": 0,
    "_color": {"__type__": "cc.Color", "r": 51, "g": 51, "b": 51, "a": 255},
    "_depth": 1,
    "_stencil": 0,
    "_clearFlags": 7,
    "_rect": {"__type__": "cc.Rect", "x": 0, "y": 0, "width": 1, "height": 1},
    "_near": 0,
    "_far": 1000,
    "_orthoHeight": 640,
    "_fov": 45,
    "_ortho": True,
    "_aperture": 19,
    "_shutter": 7,
    "_iso": 0,
    "_screenScale": 1,
    "_visibility": 41943040,
    "_targetTexture": None,
    "_postProcess": None,
    "_usePostProcess": False,
    "_cameraType": -1,
    "_trackingType": 0,
    "_id": nid(),
})
cam_comps.append({"__id__": cam_comp_id})

# Canvas components
canvas_ui_id = add(ui_transform(canvas_id, 720, 1280))
canvas_comp_id = add({
    "__type__": "cc.Canvas",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {"__id__": canvas_id},
    "_enabled": True,
    "__prefab": None,
    "_cameraComponent": {"__id__": cam_comp_id},
    "_alignCanvasWithScreen": True,
    "_id": nid(),
})
canvas_widget_id = add(widget_full(canvas_id))
canvas_comps.extend([{"__id__": canvas_ui_id}, {"__id__": canvas_comp_id}, {"__id__": canvas_widget_id}])

# Views
def add_view(name, active=True):
    comps = []
    children = []
    vid = add(make_node(name, canvas_id, children, comps, active=active))
    canvas_children.append({"__id__": vid})
    uit = add(ui_transform(vid, 720, 1280))
    wdg = add(widget_full(vid))
    comps.extend([{"__id__": uit}, {"__id__": wdg}])
    return vid, children, comps

loading_id, _, _ = add_view("LoadingView", True)
map_id, _, _ = add_view("LevelMapView", False)
game_id, game_children, game_comps = add_view("GameView", False)

# BoardRoot / TableRoot under GameView
board_comps = []
board_id = add(make_node("BoardRoot", game_id, [], board_comps))
game_children.append({"__id__": board_id})
board_ui = add(ui_transform(board_id, 720, 1280))
board_comps.append({"__id__": board_ui})

table_comps = []
table_id = add(make_node("TableRoot", game_id, [], table_comps))
game_children.append({"__id__": table_id})
table_ui = add(ui_transform(table_id, 720, 200))
# place table near bottom
objs[table_id]["_lpos"]["y"] = -480
table_comps.append({"__id__": table_ui})

# MatchGame component on GameView
match_comp_id = add({
    "__type__": "58970nYbwdAhIfa72or0CZt",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {"__id__": game_id},
    "_enabled": True,
    "__prefab": None,
    "boardRoot": {"__id__": board_id},
    "tableRoot": {"__id__": table_id},
    "_id": nid(),
})
game_comps.append({"__id__": match_comp_id})

# AudioHost
audio_comps = []
audio_id = add(make_node("AudioHost", 1, [], audio_comps, layer=1073741824))
scene_children.append({"__id__": audio_id})

# GameApp root
app_comps = []
app_id = add(make_node("GameApp", 1, [], app_comps, layer=1073741824))
scene_children.append({"__id__": app_id})
app_comp_id = add({
    "__type__": "f04bbIvWs1IcqdokmR+O8Iz",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": {"__id__": app_id},
    "_enabled": True,
    "__prefab": None,
    "loadingView": {"__id__": loading_id},
    "levelMapView": {"__id__": map_id},
    "gameView": {"__id__": game_id},
    "audioHost": {"__id__": audio_id},
    "_id": nid(),
})
app_comps.append({"__id__": app_comp_id})

# Scene globals (copy from previous)
globals_id = add({
    "__type__": "cc.SceneGlobals",
    "ambient": {"__id__": None},
    "shadows": {"__id__": None},
    "_skybox": {"__id__": None},
    "fog": {"__id__": None},
    "octree": {"__id__": None},
    "skin": {"__id__": None},
    "lightProbeInfo": {"__id__": None},
    "postSettings": {"__id__": None},
    "bakedWithStationaryMainLight": False,
    "bakedWithHighpLightmap": False,
})
objs[1]["_globals"] = {"__id__": globals_id}

ambient_id = add({
    "__type__": "cc.AmbientInfo",
    "_skyColorHDR": {"__type__": "cc.Vec4", "x": 0, "y": 0, "z": 0, "w": 0.520833125},
    "_skyColor": {"__type__": "cc.Vec4", "x": 0, "y": 0, "z": 0, "w": 0.520833125},
    "_skyIllumHDR": 20000,
    "_skyIllum": 20000,
    "_groundAlbedoHDR": {"__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1},
    "_groundAlbedo": {"__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1},
    "_skyColorLDR": {"__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1},
    "_skyIllumLDR": 1,
    "_groundAlbedoLDR": {"__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1},
})
shadows_id = add({
    "__type__": "cc.ShadowsInfo",
    "_enabled": False,
    "_type": 0,
    "_normal": {"__type__": "cc.Vec3", "x": 0, "y": 1, "z": 0},
    "_distance": 0,
    "_planeBias": 1,
    "_shadowColor": {"__type__": "cc.Color", "r": 76, "g": 76, "b": 76, "a": 255},
    "_maxReceived": 4,
    "_size": {"__type__": "cc.Vec2", "x": 512, "y": 512},
})
skybox_id = add({
    "__type__": "cc.SkyboxInfo",
    "_envLightingType": 0,
    "_envmapHDR": None,
    "_envmap": None,
    "_envmapLDR": None,
    "_diffuseMapHDR": None,
    "_diffuseMapLDR": None,
    "_enabled": False,
    "_useHDR": True,
    "_editableMaterial": None,
    "_reflectionHDR": None,
    "_reflectionLDR": None,
    "_rotationAngle": 0,
})
fog_id = add({
    "__type__": "cc.FogInfo",
    "_type": 0,
    "_fogColor": {"__type__": "cc.Color", "r": 200, "g": 200, "b": 200, "a": 255},
    "_enabled": False,
    "_fogDensity": 0.3,
    "_fogStart": 0.5,
    "_fogEnd": 300,
    "_fogAtten": 5,
    "_fogTop": 1.5,
    "_fogRange": 1.2,
    "_accurate": False,
})
octree_id = add({
    "__type__": "cc.OctreeInfo",
    "_enabled": False,
    "_minPos": {"__type__": "cc.Vec3", "x": -1024, "y": -1024, "z": -1024},
    "_maxPos": {"__type__": "cc.Vec3", "x": 1024, "y": 1024, "z": 1024},
    "_depth": 8,
})
skin_id = add({"__type__": "cc.SkinInfo", "_enabled": False, "_blurRadius": 0.01, "_sssIntensity": 3})
lp_id = add({
    "__type__": "cc.LightProbeInfo",
    "_giScale": 1,
    "_giSamples": 1024,
    "_bounces": 2,
    "_reduceRinging": 0,
    "_showProbe": False,
    "_showWireframe": False,
    "_showConvex": False,
    "_data": None,
    "_lightProbeSphereVolume": 1,
})
post_id = add({"__type__": "cc.PostSettingsInfo", "_toneMappingType": 0})

objs[globals_id]["ambient"] = {"__id__": ambient_id}
objs[globals_id]["shadows"] = {"__id__": shadows_id}
objs[globals_id]["_skybox"] = {"__id__": skybox_id}
objs[globals_id]["fog"] = {"__id__": fog_id}
objs[globals_id]["octree"] = {"__id__": octree_id}
objs[globals_id]["skin"] = {"__id__": skin_id}
objs[globals_id]["lightProbeInfo"] = {"__id__": lp_id}
objs[globals_id]["postSettings"] = {"__id__": post_id}

out = r"c:\D\gitHub\MatchExpert2\assets\scenes\Main.scene"
with open(out, "w", encoding="utf-8") as f:
    json.dump(objs, f, ensure_ascii=False, indent=2)
print("wrote", out, "objects", len(objs))
print("ids:", {
    "canvas": canvas_id,
    "loading": loading_id,
    "map": map_id,
    "game": game_id,
    "board": board_id,
    "table": table_id,
    "audio": audio_id,
    "app": app_id,
})
