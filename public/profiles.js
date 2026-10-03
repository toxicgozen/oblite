export const profiles = [
  {
    id: 'dog', name: '狗的面部与尾巴', subject: '图片中最主要的一只狗；只观察画面实际可见的部位。',
    points: [
      { id: 'nose', label: '鼻尖', instruction: '鼻头可见轮廓的中心，不是嘴巴。' },
      { id: 'left-eye', label: '左眼', instruction: '狗自身左眼的瞳孔中心；左右以狗自身为准。被遮挡时留空。' },
      { id: 'right-eye', label: '右眼', instruction: '狗自身右眼的瞳孔中心；左右以狗自身为准。被遮挡时留空。' },
      { id: 'tail-base', label: '尾根', instruction: '尾巴从身体伸出的连接处中心；不可见时留空。' },
      { id: 'tail-tip', label: '尾尖', instruction: '尾巴最末端的可见位置，不是毛发中任意一点。' },
    ],
  },
  {
    id: 'tree', name: '树的主干与枝条', subject: '图片中最主要的一棵树。主干为从地面向上延伸的主要木质轴；一级枝从主干发出，二级枝从一级枝发出。',
    points: [
      { id: 'trunk-base', label: '主干基部', instruction: '主干接近地面处的中心；画面未包括地面时留空。' },
      { id: 'trunk-mid', label: '主干中点', instruction: '主干基部到第一个主要分叉之间，沿可见主干中心走向约一半处。' },
      { id: 'trunk-fork', label: '主干分叉', instruction: '从地面向上第一个主要分叉的中心；忽略细小侧枝。' },
      { id: 'branch-base', label: '二级枝起点', instruction: '选择一条最清晰、尽可能完整可见的二级枝。标出它与一级枝相接处；不要把一级枝当成二级枝。' },
      { id: 'branch-mid', label: '二级枝中点', instruction: '与二级枝起点、末端属于同一条枝；沿它的可见中心走向约一半处。' },
      { id: 'branch-tip', label: '二级枝末端', instruction: '同一条被选中的二级枝的可见自然末端。若末端出画或无法辨认，留空。' },
    ],
  },
];
