export type Shot = {
  id: string;
  dir: string;
  shotTitle: string;
  imageSrc: string;
  vimeoId: string;
  description: string;
};

export type ShotRecommendation = Shot & {
  reason: string;
};
