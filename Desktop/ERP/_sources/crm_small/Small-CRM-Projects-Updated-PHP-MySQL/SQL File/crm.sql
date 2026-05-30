-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 24, 2025 at 05:07 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `crm`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL DEFAULT '',
  `password` varchar(255) NOT NULL DEFAULT ''
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `admin`
--

INSERT INTO `admin` (`id`, `name`, `password`) VALUES
(1, 'admin', 'Test@123');

-- --------------------------------------------------------

--
-- Table structure for table `prequest`
--

CREATE TABLE `prequest` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `contactno` varchar(11) DEFAULT NULL,
  `company` varchar(255) DEFAULT NULL,
  `wdd` varchar(255) DEFAULT NULL,
  `cms` varchar(255) DEFAULT NULL,
  `seo` varchar(255) DEFAULT NULL,
  `smo` varchar(255) DEFAULT NULL,
  `swd` varchar(255) DEFAULT NULL,
  `dwd` varchar(255) DEFAULT NULL,
  `fwd` varchar(255) DEFAULT NULL,
  `dr` varchar(255) DEFAULT NULL,
  `whs` varchar(255) DEFAULT NULL,
  `wm` varchar(255) DEFAULT NULL,
  `ed` varchar(255) DEFAULT NULL,
  `wta` varchar(255) DEFAULT NULL,
  `opi` varchar(255) DEFAULT NULL,
  `ld` varchar(255) DEFAULT NULL,
  `da` varchar(255) DEFAULT NULL,
  `osc` varchar(255) DEFAULT NULL,
  `nd` varchar(255) DEFAULT NULL,
  `others` varchar(255) DEFAULT NULL,
  `query` longtext DEFAULT NULL,
  `posting_date` date DEFAULT NULL,
  `remark` longtext DEFAULT NULL,
  `status` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `prequest`
--

INSERT INTO `prequest` (`id`, `name`, `email`, `contactno`, `company`, `wdd`, `cms`, `seo`, `smo`, `swd`, `dwd`, `fwd`, `dr`, `whs`, `wm`, `ed`, `wta`, `opi`, `ld`, `da`, `osc`, `nd`, `others`, `query`, `posting_date`, `remark`, `status`) VALUES
(1, 'Amit kumar', 'amitk@gmail.com', '1122331122', 'ABC Limited', 'Website Design & Development', '', '', 'SMO (Social Media Optimization)	', '', 'Dynamic Website Design', '', 'Domain Registration', 'Web Hosting Services', 'Website Maintenance', 'Ecommerce Development', 'Walk Through Animation', 'Online Payment Integration', 'Logo Design', '', '', '', '', 'I need a website with above services', '2025-05-24', NULL, NULL),
(2, 'Amit kumar', 'amitk@gmail.com', '1122331122', 'ABC Limited', 'Website Design & Development', '', 'SEO (Search Engine Optimization)', '', 'Static Website Design', '', 'Flash Website Development', '', 'Web Hosting Services', '', 'Ecommerce Development', '', 'Online Payment Integration', 'Logo Design', 'Dash board Application', 'Open Source Customization', '', 'Others', 'Need a attreact website for my eco0mmerce business', '2025-05-24', NULL, NULL),
(3, 'Garima Singh', 'garima123@gmail.com', '1425362514', 'XYZ Pvt Limited', '', '', 'SEO (Search Engine Optimization)', 'SMO (Social Media Optimization)	', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'I have awebsite need SEO and SMO services for the website.', '2025-05-24', 'We will do the task. Emtimate cos t will 500USd per month', NULL),
(4, 'John Doe', 'johndoe123@gmail.com', '1234567890', 'Amzion Limites', 'Website Design & Development', 'CMS (Content Management System)', 'SEO (Search Engine Optimization)', 'SMO (Social Media Optimization)	', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Need the website for my business', '2025-05-24', 'We will develop the website in MERN StACk. Cost will be 20000 USD and 6 week time', NULL),
(5, 'Test Sample', 'test123@gmauil.com', '7894561239', 'PVR pvt ltd', 'Website Design & Development', '', 'SEO (Search Engine Optimization)', '', 'Static Website Design', '', 'Flash Website Development', '', 'Web Hosting Services', '', 'Ecommerce Development', '', '', '', '', '', '', '', 'Need invoice of selcted servicesw', '2025-05-24', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `ticket`
--

CREATE TABLE `ticket` (
  `id` int(11) NOT NULL,
  `ticket_id` varchar(11) DEFAULT NULL,
  `email_id` varchar(300) DEFAULT NULL,
  `subject` varchar(300) DEFAULT NULL,
  `task_type` varchar(300) DEFAULT NULL,
  `prioprity` varchar(300) DEFAULT NULL,
  `ticket` longtext DEFAULT NULL,
  `attachment` varchar(300) DEFAULT NULL,
  `status` varchar(300) DEFAULT NULL,
  `admin_remark` longtext DEFAULT NULL,
  `posting_date` date DEFAULT NULL,
  `admin_remark_date` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `ticket`
--

INSERT INTO `ticket` (`id`, `ticket_id`, `email_id`, `subject`, `task_type`, `prioprity`, `ticket`, `attachment`, `status`, `admin_remark`, `posting_date`, `admin_remark_date`) VALUES
(1, '6', 'amitk@gmail.com', 'Regarding webstie Bug', 'ot1', 'urgent(functional problem)', 'This the website asap', NULL, 'closed', 'Bug is fixed now', '2025-05-24', '2025-05-24 10:35:44'),
(2, '7', 'johndoe123@gmail.com', 'For payment', 'ot1', 'question', 'How can I make the payment for my service', NULL, 'closed', 'You have to pay on this link xyz.com/payment', '2025-05-24', '2025-05-24 10:47:28'),
(3, '8', 'test123@gmauil.com', 'I am not get previous invoice', 'billing', 'important', 'I am not get previous invoice', NULL, 'Open', NULL, '2025-05-24', '2025-05-24 11:21:22');

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `alt_email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `mobile` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `status` int(11) DEFAULT NULL,
  `posting_date` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `name`, `email`, `alt_email`, `password`, `mobile`, `gender`, `address`, `status`, `posting_date`) VALUES
(2, 'Amit kumar', 'amitk@gmail.com', 'amk12@gmail.com', 'Test@123', '1122331122', 'm', 'NA', NULL, '2025-05-24 10:10:22'),
(3, 'Garima Singh', 'garima123@gmail.com', '', 'Test@123', '1425362514', '<br />\r\n<b>Warning</b>:  Undefined variable $row in <b>C:xampphtdocsfree-projectscrmadminedit-user.php</b> on line <b>94</b><br />\r\n<br />\r\n<b>Warning</b>:  Trying to access array offset on value of type null in <b>C:xampphtdocsfree-projectscrmadminedit-u', 'New Delhi India', NULL, '2025-05-24 10:32:44'),
(6, 'Test Sample', 'test123@gmauil.com', 'test@gmail.com', '123', '7894561239', 'm', 'l-980, Kimmi Aparment', NULL, '2025-05-24 11:12:16');

-- --------------------------------------------------------

--
-- Table structure for table `usercheck`
--

CREATE TABLE `usercheck` (
  `id` int(11) NOT NULL,
  `logindate` varchar(255) DEFAULT '',
  `logintime` varchar(255) DEFAULT '',
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT '',
  `ip` varbinary(16) DEFAULT NULL,
  `mac` varbinary(16) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `country` varchar(255) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `usercheck`
--

INSERT INTO `usercheck` (`id`, `logindate`, `logintime`, `user_id`, `username`, `email`, `ip`, `mac`, `city`, `country`) VALUES
(1, '2025/05/24', '03:40:31pm', 2, 'Amit kumar', 'amitk@gmail.com', 0x3a3a31, 0x42432d45392d32462d45422d45442d36, '', ''),
(2, '2025/05/24', '04:02:52pm', 3, 'Garima Singh', 'garima123@gmail.com', 0x3a3a31, 0x42432d45392d32462d45422d45442d36, '', ''),
(3, '2025/05/24', '04:15:15pm', 5, 'John Doe', 'johndoe123@gmail.com', 0x3a3a31, 0x42432d45392d32462d45422d45442d36, '', ''),
(4, '2025/05/24', '04:43:23pm', 6, 'Test Sample', 'test123@gmauil.com', 0x3a3a31, 0x42432d45392d32462d45422d45442d36, '', '');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `prequest`
--
ALTER TABLE `prequest`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `ticket`
--
ALTER TABLE `ticket`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `usercheck`
--
ALTER TABLE `usercheck`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `prequest`
--
ALTER TABLE `prequest`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `ticket`
--
ALTER TABLE `ticket`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `usercheck`
--
ALTER TABLE `usercheck`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
