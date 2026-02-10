import * as React from "react";
import "./MoodWheelComp.css";
import { PieChart, pieArcLabelClasses } from "@mui/x-charts/PieChart";
import useMediaQuery from "@mui/material/useMediaQuery";

const MoodWheelComp = ({ setMood }) => {
  const isNarrow = useMediaQuery("(max-width: 860px)");
  const isCompact = useMediaQuery("(max-width: 560px)");

  // Define your data, styling, and other props for the pie chart
  const items = [
    { label: "Happy", value: 25 },
    { label: "Sad", value: 25 },
    { label: "Surprised", value: 25 },
    { label: "Neutral", value: 25 },
    { label: "Angry", value: 25 },
    { label: "Scared", value: 25 },
    { label: "Disgust", value: 25 },
  ];
  const colorPalette = [
    "#f7cb61",
    "#5fa4ff",
    "#f28a63",
    "#9db2c6",
    "#ff6862",
    "#47d5c0",
    "#8fcb66",
  ];

  const handlePieChartClick = (event, item) => {
    if (item?.dataIndex == null) {
      return;
    }
    setMood(items[item.dataIndex].label);
  };

  const chartWidth = isCompact ? 310 : isNarrow ? 500 : 760;
  const chartHeight = isCompact ? 360 : isNarrow ? 420 : 520;
  const arcLabelSize = isCompact ? 13 : isNarrow ? 16 : 22;
  const outerRadius = isCompact ? 138 : isNarrow ? 170 : 220;
  const innerRadius = isCompact ? 44 : isNarrow ? 52 : 64;

  return (
    <div className="moodwheel-chart">
      <PieChart
        colors={colorPalette}
        series={[
          {
            arcLabel: (item) => item.label,
            data: items,
            outerRadius,
            innerRadius,
            paddingAngle: 1.5,
            cornerRadius: 9,
            highlightScope: { faded: "global", highlighted: "item", preview: false },
            faded: { innerRadius: innerRadius + 8, additionalRadius: -12 },
          },
        ]}
        sx={{
          [`& .${pieArcLabelClasses.root}`]: {
            fill: "#eaf2ff",
            fontFamily: "Space Grotesk",
            fontWeight: 700,
            fontSize: `${arcLabelSize}px`,
            letterSpacing: "0.01em",
          },
          "& .MuiPieArc-root": {
            stroke: "rgba(6, 18, 31, 0.62)",
            strokeWidth: 1,
          },
        }}
        onClick={handlePieChartClick}
        width={chartWidth}
        height={chartHeight}
        margin={{ right: isNarrow ? 12 : 40, left: 8, top: 12, bottom: 8 }}
      />
    </div>
  );
};

export default MoodWheelComp;
