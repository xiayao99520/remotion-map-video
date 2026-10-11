# Route text reference

Save UTF-8 text exactly as received. The first line may be `城市：城市名`; otherwise pass `--city 城市名`. Split stops with `→`, `->`, or `=>`. A travel word before each arrow belongs to the leg from that stop to the next.

## Syntax

- Place name: `地名`
- Address: `地名（地址）` or `地名 (address)`
- Travel synonyms: `走路/步行/走` → walk; `车/打车/开车/驾车/出租车/网约车` → car; `地铁` → metro; `高铁/动车/火车` → train.
- Manual coordinate: `@纬度,经度`, for example `@22.8153525,108.3182634`. The parser stores `[经度,纬度]`; do not swap it again. Use WGS-84 from Google Maps or OpenStreetMap. Gaode/Baidu coordinates are offset.
- Manual icon: `#🍜` (one emoji). The parser also recommends an icon and prints it in the matching table.

## Examples

```text
城市：南宁
舒记粉店七星总店（七星路44号）车→三街两巷（青秀区）走路→水街老牌凉茶（水街27号）地铁→冰神糖水铺（中山路256-1号）高铁→亭子码头
```

```text
城市：杭州
雷峰塔#🏯 车→柳浪闻莺（西湖边）步行→岳王庙@30.2571,120.1486
```

```text
上海外滩@31.2397,121.4904 走路→豫园#🏮 地铁→虹桥火车站
```

A missing travel word defaults to walking and is reported as a warning. A mode after the final stop is ignored and reported. If a place is not found, the command exits without writing a route JSON; make the name/landmark more specific or provide a verified coordinate.
