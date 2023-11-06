/* eslint-disable react/react-in-jsx-scope */
// eslint-disable-next-line import/no-extraneous-dependencies
import PropTypes from 'prop-types';

// eslint-disable-next-line react/no-danger
export const Html = ({ content }) => <div dangerouslySetInnerHTML={{ __html: content }} />;

Html.propTypes = {
  content: PropTypes.string.isRequired,
};
