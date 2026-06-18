import React, { useMemo, useState } from "react";
import { BellOutlined, HeartOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";

import { MarkitAvatar } from "../../components/MarkitAvatar";
import { MarkitBadge } from "../../components/MarkitBadge";
import { MarkitArtwork, ArtworkVariant } from "../../components/MarkitArtwork";
import "./markitLanding.css";

type MarkitCard = {
  category: CategoryKey;
  title: string;
  author: string;
  likes: string;
  artwork: ArtworkVariant;
};

type CategoryKey = "all" | "fashion" | "beauty" | "food" | "lifestyle" | "tech" | "travel" | "home" | "art";

const cards: MarkitCard[] = [
  {
    category: "fashion",
    title: "今年春天最出片的红色穿搭灵感",
    author: "穿搭日记",
    likes: "2400",
    artwork: "fashion-red",
  },
  {
    category: "lifestyle",
    title: "让效率翻倍的极简居家办公角落",
    author: "效率研究所",
    likes: "1200",
    artwork: "workspace",
  },
  {
    category: "beauty",
    title: "睡前五步护理，养出透亮好状态",
    author: "发光计划",
    likes: "3100",
    artwork: "skincare",
  },
  {
    category: "tech",
    title: "这副降噪耳机真的适合通勤吗",
    author: "数码听感",
    likes: "540",
    artwork: "headphones",
  },
  {
    category: "food",
    title: "东京街角那家松软到离谱的松饼",
    author: "城市食帖",
    likes: "6200",
    artwork: "pancakes",
  },
  {
    category: "food",
    title: "周末早午餐清单，这几家值得一试",
    author: "寻味地图",
    likes: "852",
    artwork: "brunch",
  },
  {
    category: "travel",
    title: "泰国这些小众海滩，安静又好拍",
    author: "慢游记",
    likes: "4800",
    artwork: "lagoon",
  },
  {
    category: "home",
    title: "把小单间改造成温暖的休息角",
    author: "住得舒服",
    likes: "920",
    artwork: "sanctuary",
  },
  {
    category: "fashion",
    title: "光影感大片：日常也能拍出杂志氛围",
    author: "镜头玩家",
    likes: "2700",
    artwork: "editorial",
  },
  {
    category: "art",
    title: "新展推荐：半透明材质里的光与层次",
    author: "看展指南",
    likes: "1500",
    artwork: "curtain",
  },
];

const categories: Array<{ key: CategoryKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "fashion", label: "穿搭" },
  { key: "beauty", label: "美妆" },
  { key: "food", label: "美食" },
  { key: "lifestyle", label: "生活" },
  { key: "tech", label: "数码" },
  { key: "travel", label: "旅行" },
  { key: "home", label: "家居" },
];

export function MarkitLanding({
  onLoginClick,
}: {
  onLoginClick: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

  const filteredCards = useMemo(() => {
    if (activeCategory === "all") {
      return cards;
    }
    return cards.filter((card) => card.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="markit-shell">
      <header className="markit-header">
        <div className="markit-header-inner">
          <div className="markit-brand">
            <span className="markit-brand-text">MarkIt</span>
            <nav className="markit-header-links" aria-label="主导航">
              <a className="active" href="/#explore" onClick={(e) => e.preventDefault()}>
                发现
              </a>
              <a href="/#nearby" onClick={(e) => e.preventDefault()}>
                附近
              </a>
              <a href="/#follow" onClick={(e) => e.preventDefault()}>
                关注
              </a>
            </nav>
          </div>

          <label className="markit-search" aria-label="搜索">
            <SearchOutlined className="markit-search-icon" />
            <input placeholder="搜索热门内容..." type="text" />
          </label>

          <div className="markit-header-actions">
            <button className="markit-icon-button" type="button" aria-label="通知">
              <BellOutlined />
            </button>
            <button className="markit-post-button" type="button">
              发布
            </button>
            <button className="markit-avatar-button" type="button" onClick={onLoginClick} aria-label="打开登录页">
              <MarkitBadge size={28} />
            </button>
          </div>
        </div>
      </header>

      <nav className="markit-subnav" aria-label="内容分类">
        <div className="markit-subnav-inner">
          {categories.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`markit-subnav-button ${activeCategory === category.key ? "active" : ""}`}
              onClick={() => setActiveCategory(category.key)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="markit-main" id="explore">
        <div className="markit-grid">
          {filteredCards.map((card) => (
            <article key={`${card.title}-${card.author}`} className="markit-card">
              <div className="markit-card-media">
                <MarkitArtwork className="markit-card-artwork" variant={card.artwork} title={card.title} />
              </div>
              <div className="markit-card-body">
                <h3 className="markit-card-title">{card.title}</h3>
                <div className="markit-card-meta">
                  <div className="markit-card-author">
                    <MarkitAvatar name={card.author} />
                    <span>{card.author}</span>
                  </div>
                  <div className="markit-card-likes">
                    <HeartOutlined />
                    <span>{card.likes}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <button className="markit-fab" type="button" aria-label="创建内容">
        <PlusOutlined />
      </button>
    </div>
  );
}

export default MarkitLanding;
