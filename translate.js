/* Çince mağaza adı → İngilizce (tamamen çevrimdışı)
 * Bilinen marka ve kelimeler İngilizce karşılığıyla, bilinmeyen özel isimler pinyin ile yazılır.
 * Örnek: 南极人嘉恒专卖店 → "Nanjiren Jiaheng Store", 高原牛肉拉面 → "Plateau Beef Ramen"
 * Yeni kelime eklemek için WORDS listesine bir satır eklemen yeterli.
 */
window.NameEN = (() => {
  const WORDS = `
高德打车=Amap Taxi|高德=Amap|滴滴出行=DiDi|滴滴=DiDi|美团外卖=Meituan Delivery|美团=Meituan|饿了么=Ele.me|大众点评=Dianping
瑞幸咖啡=Luckin Coffee|瑞幸=Luckin|星巴克=Starbucks|库迪=Cotti|喜茶=Heytea|奈雪=Nayuki|蜜雪冰城=Mixue|霸王茶姬=Chagee|茶百道=ChaPanda|古茗=Goodme
麦当劳=McDonald's|肯德基=KFC|汉堡王=Burger King|必胜客=Pizza Hut|达美乐=Domino's|赛百味=Subway|塔斯汀=Tastien|华莱士=Wallace|德克士=Dicos|海底捞=Haidilao|西贝=Xibei|老乡鸡=Lao Xiang Ji
盒马鲜生=Hema Fresh|盒马=Hema|沃尔玛=Walmart|家乐福=Carrefour|山姆=Sam's Club|永辉=Yonghui|大润发=RT-Mart|华润万家=CR Vanguard|物美=Wumart|全家=FamilyMart|罗森=Lawson|便利蜂=Bianlifeng|美宜佳=Meiyijia|叮咚买菜=Dingdong|朴朴=Pupu|百果园=Pagoda
淘宝=Taobao|天猫=Tmall|京东=JD|拼多多=Pinduoduo|闲鱼=Xianyu|抖音=Douyin|唯品会=Vipshop|得物=Dewu|南极人=Nanjiren|优衣库=Uniqlo|无印良品=MUJI|名创优品=Miniso|宜家=IKEA|迪卡侬=Decathlon|安踏=Anta|李宁=Li-Ning|小米=Xiaomi|华为=Huawei|苹果=Apple|屈臣氏=Watsons|丝芙兰=Sephora
中国移动=China Mobile|中国联通=China Unicom|中国电信=China Telecom|联通=Unicom|移动=Mobile|电信=Telecom|联合网络通信=Unicom|美团点餐=Meituan Ordering|点餐=Ordering|默认商品=Default Item|叮叮充电=Dingding Charging|中国银联=China UnionPay|银联=UnionPay|中国石化=Sinopec|中国石油=PetroChina|国家电网=State Grid
携程=Trip.com|去哪儿=Qunar|飞猪=Fliggy|哈啰=Hellobike|青桔=Qingju|曹操出行=Caocao|顺丰=SF Express|菜鸟=Cainiao|收钱吧=Shouqianba|支付宝=Alipay|微信=WeChat|财付通=Tenpay|爱奇艺=iQIYI|腾讯=Tencent|哔哩哔哩=Bilibili|网易=NetEase|阿里巴巴=Alibaba
中国=China|北京=Beijing|上海=Shanghai|广州=Guangzhou|深圳=Shenzhen|杭州=Hangzhou|南京=Nanjing|苏州=Suzhou|成都=Chengdu|重庆=Chongqing|武汉=Wuhan|西安=Xi'an|天津=Tianjin|长沙=Changsha|郑州=Zhengzhou|青岛=Qingdao|厦门=Xiamen|桂林=Guilin|南宁=Nanning|昆明=Kunming|义乌=Yiwu|宁波=Ningbo|东莞=Dongguan|佛山=Foshan|合肥=Hefei|济南=Jinan|沈阳=Shenyang|大连=Dalian|哈尔滨=Harbin|乌鲁木齐=Urumqi|兰州=Lanzhou|福州=Fuzhou|贵阳=Guiyang|海口=Haikou|三亚=Sanya|珠海=Zhuhai|无锡=Wuxi|温州=Wenzhou|灵川=Lingchuan|阳朔=Yangshuo|沙县=Shaxian
广西=Guangxi|广东=Guangdong|浙江=Zhejiang|江苏=Jiangsu|四川=Sichuan|云南=Yunnan|贵州=Guizhou|湖南=Hunan|湖北=Hubei|河南=Henan|河北=Hebei|山东=Shandong|山西=Shanxi|陕西=Shaanxi|福建=Fujian|江西=Jiangxi|安徽=Anhui|海南=Hainan|甘肃=Gansu|新疆=Xinjiang|西藏=Tibet|内蒙古=Inner Mongolia|宁夏=Ningxia|青海=Qinghai|黑龙江=Heilongjiang|吉林=Jilin|辽宁=Liaoning|香港=Hong Kong|澳门=Macau|台湾=Taiwan
有限责任公司=Co., Ltd.|股份有限公司=Co., Ltd.|有限公司=Co., Ltd.|分公司=Branch|公司=Company|集团=Group|科技=Technology|网络技术=Network Technology|网络=Network|信息=Information|技术=Technology|服务=Service|支付=Payment|餐饮=Catering|管理=Management|文化=Culture|传媒=Media|贸易=Trading|商贸=Trading|商行=Trading|电子商务=E-commerce|电子=Electronics|实业=Industrial|发展=Development|投资=Investment|物业=Property|连锁=Chain|生活=Life|个体户=Sole Trader|经营部=Business Dept.
旗舰店=Flagship Store|专卖店=Store|专营店=Specialty Store|官方=Official|自营=Self-operated|直营店=Direct Store|体验店=Experience Store|分店=Branch|总店=Main Store|门店=Store|店铺=Store|小店=Shop|商店=Shop|网店=Online Shop|店=Store
超市=Supermarket|超级市场=Supermarket|便利店=Convenience Store|便利=Convenience|小卖部=Kiosk|杂货=Grocery|百货=Department Store|商场=Mall|购物中心=Shopping Center|广场=Plaza|市场=Market|菜市场=Wet Market|农贸市场=Farmers Market|批发=Wholesale|零售=Retail|烟酒=Tobacco & Liquor|粮油=Grain & Oil|食品=Food|特产=Local Specialties|平价=Discount|优选=Select|鲜生=Fresh|生鲜=Fresh Food|水果=Fruit|蔬菜=Vegetables|果业=Fruit
酒店=Hotel|宾馆=Hotel|旅馆=Inn|民宿=Guesthouse|客栈=Inn|公寓=Apartment|饭店=Restaurant|餐厅=Restaurant|餐馆=Restaurant|饭馆=Restaurant|酒楼=Restaurant|食府=Restaurant|菜馆=Restaurant|食堂=Canteen|小吃=Snacks|快餐=Fast Food|面馆=Noodle House|拉面=Ramen|牛肉面=Beef Noodles|面条=Noodles|盖浇面=Noodles with Topping|盖浇饭=Rice Bowl|盖饭=Rice Bowl|炒饭=Fried Rice|米饭=Rice|米线=Rice Noodles|米粉=Rice Noodles|粉店=Noodle Shop|面=Noodles|饭=Rice|粥=Congee
牛肉=Beef|羊肉=Lamb|猪肉=Pork|鸡肉=Chicken|鸡=Chicken|鸭=Duck|烤鸭=Roast Duck|鱼=Fish|酸菜鱼=Pickled Fish|虾=Shrimp|海鲜=Seafood|烧烤=BBQ|烤肉=BBQ|串串=Skewers|火锅=Hotpot|麻辣烫=Malatang|麻辣香锅=Spicy Pot|麻辣=Spicy|黄焖鸡=Braised Chicken|饺子=Dumplings|水饺=Dumplings|包子=Buns|馒头=Steamed Buns|煎饼=Pancakes|汉堡=Burger|炸鸡=Fried Chicken|披萨=Pizza|面包=Bakery|蛋糕=Cake|烘焙=Bakery|甜品=Desserts|奶茶=Milk Tea|茶饮=Tea|茶=Tea|咖啡=Coffee|果汁=Juice|饮品=Drinks|啤酒=Beer|酒吧=Bar|酒=Liquor|清真=Halal|孜然=Cumin|家常菜=Home Cooking|私房菜=Private Kitchen|川菜=Sichuan Cuisine|湘菜=Hunan Cuisine|粤菜=Cantonese Cuisine|东北=Northeast|西北=Northwest|高原=Plateau
大药房=Pharmacy|药店=Pharmacy|药房=Pharmacy|医药=Pharmacy|医院=Hospital|诊所=Clinic|门诊=Clinic|口腔=Dental|牙科=Dental|理发=Barber|美发=Hair Salon|美容=Beauty|美甲=Nails|洗衣=Laundry|干洗=Dry Cleaning|按摩=Massage|足疗=Foot Massage|健身=Fitness|影城=Cinema|电影院=Cinema|书店=Bookstore|文具=Stationery|五金=Hardware|家具=Furniture|家居=Home|电器=Electronics|数码=Digital|手机=Phone|通讯=Telecom|服装=Clothing|服饰=Apparel|女装=Women's Clothing|男装=Men's Clothing|童装=Kids' Clothing|鞋业=Footwear|鞋=Shoes|内衣=Underwear|母婴=Mother & Baby|化妆品=Cosmetics|眼镜=Optical|珠宝=Jewelry|花店=Florist|鲜花=Flowers|宠物=Pet|打印=Printing|快递=Courier
出行=Mobility|打车=Taxi|出租车=Taxi|地铁=Metro|公交站=Bus Stop|公交=Bus|火车站=Train Station|高铁=High-speed Rail|机场=Airport|停车场=Parking|停车=Parking|加油站=Gas Station|充电=Charging|进站口=Entrance|出站口=Exit|东站=East Station|西站=West Station|南站=South Station|北站=North Station|站=Station
东路=East Road|西路=West Road|南路=South Road|北路=North Road|中路=Middle Road|大道=Avenue|大街=Street|路=Road|街=Street|巷=Lane|区=District|县=County|市=City|省=Province|镇=Town|村=Village|大学=University|学校=School|校区=Campus|大厦=Tower|中心=Center
订单=Order|免密支付=Auto-pay|收款=Payment|收钱码=Payment QR|红包=Red Packet|转账=Transfer|充值=Top-up|退款=Refund`;

  const DICT = new Map();
  let maxLen = 1;
  WORDS.split(/[|\n]/).forEach(p => {
    const i = p.indexOf('=');
    if (i < 1) return;
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    DICT.set(k, v);
    maxLen = Math.max(maxLen, k.length);
  });

  const PY = {};
  (window.PINYIN_DATA || '').split(',').forEach(g => {
    const [p, chars] = g.split(':');
    if (chars) for (const c of chars) PY[c] = p;
  });

  const isCjk = c => /[㐀-鿿豈-﫿]/.test(c);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const cache = new Map();

  function toEnglish(zh) {
    if (!zh) return '';
    if (cache.has(zh)) return cache.get(zh);
    let s = String(zh)
      .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[【〔]/g, '(').replace(/[】〕]/g, ')').replace(/[·•]/g, ' ');
    const tokens = [];
    let pinyinRun = '';
    const flush = () => { if (pinyinRun) { tokens.push(cap(pinyinRun)); pinyinRun = ''; } };
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      // 88号 → No. 88
      const num = s.slice(i).match(/^(\d+)号/);
      if (num) { flush(); tokens.push('No. ' + num[1]); i += num[0].length; continue; }
      if (!isCjk(c)) {
        flush();
        let j = i;
        while (j < s.length && !isCjk(s[j])) j++;
        tokens.push(s.slice(i, j));
        i = j;
        continue;
      }
      let hit = null;
      for (let L = Math.min(maxLen, s.length - i); L >= 1; L--) {
        const w = s.substr(i, L);
        if (DICT.has(w)) { hit = w; break; }
      }
      if (hit) { flush(); tokens.push(DICT.get(hit)); i += hit.length; continue; }
      pinyinRun += PY[c] || '';
      i++;
    }
    flush();
    const out = tokens.join(' ')
      .replace(/\s*\(\s*/g, ' (').replace(/\s*\)\s*/g, ') ')
      .replace(/\s*-\s*/g, ' - ').replace(/\s*\|\s*/g, ' | ')
      .replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ')
      .replace(/ \)/g, ')').replace(/\( /g, '(')
      .replace(/\b(\w[\w']*) \1\b/g, '$1') // "Store Store" gibi tekrarları at
      .trim();
    cache.set(zh, out || zh);
    return out || zh;
  }

  return { toEnglish };
})();
